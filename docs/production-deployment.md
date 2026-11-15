# Production deployment

DataCurrent ships a single-host production profile for Google Compute Engine. It keeps PostgreSQL and Redis on private Docker networks, exposes only Caddy on ports 80 and 443, obtains and renews TLS certificates automatically, and persists metadata, cache state, certificates, and daily database backups in named volumes.

## Topology

```text
Browser → Porkbun DNS → static GCE IPv4 → Caddy HTTPS
                                         ├─ /api/* → FastAPI
                                         └─ /*     → Next.js

FastAPI + Celery worker + Celery beat → PostgreSQL + Redis
Backup service                         → 14 days of PostgreSQL dumps
```

The baseline host is an `e2-medium` VM in `us-west1` with a 30 GB balanced persistent disk. This profile is intended for an initial production workload. Move PostgreSQL, Redis, and backups to managed services before introducing a multi-host deployment or a stricter recovery objective.

## Files

- `infrastructure/deployment/compose.prod.yml` — production services and persistent volumes.
- `infrastructure/deployment/Caddyfile` — automatic TLS, same-origin API routing, compression, and security headers.
- `infrastructure/deployment/bootstrap-gce.sh` — idempotent host bootstrap.
- `infrastructure/deployment/deploy-gce.ps1` — GCE provisioning and release deployment.
- `infrastructure/deployment/verify-production.ps1` — public HTTPS acceptance checks.

## One-time environment

Create `infrastructure/deployment/.env.production.local` from `.env.production.example`. It is ignored by Git. Use independent random values for the session secret, Fernet connection-encryption key, and PostgreSQL password. Keep `DATACURRENT_ALLOW_REGISTRATION=false` after the owner account exists.

The required keys are:

```dotenv
DATACURRENT_DOMAIN=datacurrent.jonzhang.dev
ACME_EMAIL=owner@example.com
DATACURRENT_ALLOW_REGISTRATION=false
DATACURRENT_SECRET_KEY=...
DATACURRENT_ENCRYPTION_KEY=...
POSTGRES_PASSWORD=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
```

## Provision and deploy

Authenticate the Google Cloud CLI, then run from the repository root:

```powershell
& infrastructure/deployment/deploy-gce.ps1
```

The deployer enables Compute Engine, reserves a regional IPv4 address, creates narrowly scoped web and IAP SSH firewall rules, provisions the VM, copies the ignored production environment over IAP, and starts the exact Git release with Docker Compose.

The command returns the static `public_ip`. Add this Porkbun record without altering the apex records:

| Type | Host | Answer | TTL |
| --- | --- | --- | --- |
| A | `datacurrent` | returned `public_ip` | 600 |

Caddy requests the certificate after DNS resolves to the VM. Verify propagation and the complete public origin:

```powershell
Resolve-DnsName datacurrent.jonzhang.dev -Type A
& infrastructure/deployment/verify-production.ps1
```

## First owner

For a fresh database, briefly set `DATACURRENT_ALLOW_REGISTRATION=true`, deploy, create the owner workspace through `/login`, immediately set it back to `false`, and redeploy. The public registration switch is enforced by the API as well as hidden in the UI; disabling it cannot be bypassed by calling the registration endpoint directly.

## Releases and rollback

The deployer records the Git SHA on the instance and only accepts a clean local repository. Normal updates use a fast-forward pull followed by an idempotent Compose build and migration gate.

Before rollback, take a metadata backup and confirm that the target release supports the current schema. Check out the intended release under `/opt/datacurrent`, then run:

```bash
sudo docker compose --env-file infrastructure/deployment/.env.production.local \
  -f infrastructure/deployment/compose.prod.yml up -d --build
```

## Backups and operations

The backup container writes a compressed PostgreSQL dump every 24 hours and removes dumps older than 14 days. These dumps share the VM failure domain; export them to an independent object store before relying on the deployment for business-critical recovery.

Use the existing health contracts for monitoring:

- `/api/v1/healthz` — process liveness.
- `/api/v1/readyz` — PostgreSQL and Redis readiness.
- `/` — Next.js and Caddy routing.

Do not expose PostgreSQL, Redis, the API container, or the Next.js container directly to the public network.
