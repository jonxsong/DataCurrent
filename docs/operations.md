# Operations

## Health and readiness

- `GET /api/v1/healthz` proves the API process is alive.
- `GET /api/v1/readyz` checks metadata PostgreSQL and Redis dependencies.
- Compose health checks gate migration, API, workers, and web startup.

Use readiness for load-balancer membership and liveness only for process replacement. Do not restart the API because a source database is temporarily unavailable.

## Migrations

Run `alembic upgrade head` exactly once per release before rolling out API and worker instances. The Compose `migrate` one-shot service performs this gate automatically.

## Collection

Celery beat schedules collection and retention. Each connection job holds a Redis lock so retries or multiple beat instances do not overlap the same collection interval. Jobs are safe to retry because fingerprints and metric intervals use stable identities.

## Backups

Back up metadata PostgreSQL and the connection-encryption key. Redis is reconstructible control state. The seeded demo database is disposable and reproducible from source.

## Observability

API logs are structured and include request IDs. Source-specific errors are stored as bounded error codes on the connection record. Avoid logging SQL literals, credentials, cookies, or complete provider exceptions.

## Upgrade checklist

1. Back up metadata and the encryption key.
2. Run CI and build both production images.
3. Apply migrations.
4. Deploy API and workers, then the web image.
5. Check readiness, a PostgreSQL connection test, and a Snowflake connection test.
6. Confirm collection timestamps advance and no lock remains beyond its TTL.
7. Run one isolated benchmark and verify result agreement.

