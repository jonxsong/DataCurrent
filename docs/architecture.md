# Architecture

DataCurrent is a multi-tenant control plane that observes authorized database workloads without becoming part of the query path. Losing DataCurrent must never interrupt application traffic.

## Runtime components

| Component | Responsibility | Persistent state |
|---|---|---|
| Next.js web | Product story, operator workflow, visualization, plan editor | None |
| FastAPI API | Sessions, RBAC, workspace scoping, evidence and benchmark contracts | Metadata PostgreSQL |
| Celery worker/beat | Collection, catalog sync, regression detection, retention | Metadata PostgreSQL; Redis locks |
| Redis | Broker and idempotency locks | Ephemeral, append-only locally |
| Metadata PostgreSQL | Users, tenants, encrypted connections, metrics, plans, evidence, lineage, audit | Durable |
| Source connectors | PostgreSQL and Snowflake read-only access | None |
| OpenAI agent | Structured reasoning over minimized evidence tools | No credentials or source rows |

## Data flow

1. A scheduled worker acquires a per-connection Redis lock.
2. The provider connector reads cumulative or historical workload signals with a read-only role.
3. SQL is normalized and redacted into a stable fingerprint. Snapshots retain source and reset semantics.
4. Deterministic regression logic compares recent and baseline windows.
5. An operator opens an investigation and selects the evidence the AI may inspect.
6. The investigator calls only in-process evidence tools and returns a typed report.
7. A candidate may be evaluated only through a connection explicitly marked `benchmark_only`.
8. The benchmark stores raw measurements, median, p95, environment, method, and result agreement.

## Tenancy

Every user-facing metadata query is scoped through a validated workspace membership. Roles are ordered `viewer → member → admin → owner`. Resource lookups include the workspace identifier instead of authorizing an object after retrieval.

## Failure behavior

- Source timeouts fail a collection job; they do not affect source traffic.
- Redis locks prevent overlapping periodic collection while Celery retries transient failures with backoff.
- Missing OpenAI configuration disables only the investigator endpoint with an explicit `503` error.
- A source reset starts a new counter interval instead of creating a false negative delta.
- Invalid or mutating SQL is rejected before it reaches Query Lab or verification.

## Deployment shape

The repository ships production images for the web and API/worker runtimes. Compose is the reproducible development and single-host deployment baseline. For a distributed deployment, run the same images behind TLS, use managed PostgreSQL and Redis, inject secrets from a secrets manager, and scale API and workers independently.

