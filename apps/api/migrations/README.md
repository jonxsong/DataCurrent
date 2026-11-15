# Database migrations

The initial migration creates the complete normalized metadata schema from the frozen v0.1 model set.
Every subsequent schema change must use an explicit Alembic revision and be reviewed with both upgrade and
downgrade tests against PostgreSQL. Production deploys run `alembic upgrade head` as a separate release step;
the API process never mutates its own schema at startup.
