# Snowflake setup

Snowflake is a first-class DataCurrent provider. Collection uses account query history, catalog sync uses information schema, Query Lab requests JSON plans, and benchmarks use a separately marked connection.

## Recommended roles

Run the following as a role allowed to manage access. Replace the uppercase identifiers for your account.

```sql
CREATE ROLE IF NOT EXISTS DATACURRENT_MONITOR;
GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE DATACURRENT_MONITOR;
GRANT USAGE ON WAREHOUSE DATACURRENT_WH TO ROLE DATACURRENT_MONITOR;
GRANT USAGE ON DATABASE ANALYTICS TO ROLE DATACURRENT_MONITOR;
GRANT USAGE ON ALL SCHEMAS IN DATABASE ANALYTICS TO ROLE DATACURRENT_MONITOR;
GRANT SELECT ON ALL TABLES IN DATABASE ANALYTICS TO ROLE DATACURRENT_MONITOR;
GRANT SELECT ON ALL VIEWS IN DATABASE ANALYTICS TO ROLE DATACURRENT_MONITOR;
GRANT USAGE ON FUTURE SCHEMAS IN DATABASE ANALYTICS TO ROLE DATACURRENT_MONITOR;
GRANT SELECT ON FUTURE TABLES IN DATABASE ANALYTICS TO ROLE DATACURRENT_MONITOR;
GRANT SELECT ON FUTURE VIEWS IN DATABASE ANALYTICS TO ROLE DATACURRENT_MONITOR;

CREATE USER IF NOT EXISTS DATACURRENT_SERVICE
  PASSWORD = '<GENERATE-A-UNIQUE-SECRET>'
  DEFAULT_ROLE = DATACURRENT_MONITOR
  DEFAULT_WAREHOUSE = DATACURRENT_WH
  MUST_CHANGE_PASSWORD = FALSE;
GRANT ROLE DATACURRENT_MONITOR TO USER DATACURRENT_SERVICE;
```

For benchmarks, create a separate `DATACURRENT_BENCHMARK` role and user with access only to an isolated clone or test schema. Mark that connection as benchmark-only in DataCurrent.

## Connection payload

```json
{
  "name": "Analytics Snowflake",
  "benchmark_only": false,
  "config": {
    "provider": "snowflake",
    "account": "org-account",
    "username": "DATACURRENT_SERVICE",
    "password": "from-your-secret-manager",
    "warehouse": "DATACURRENT_WH",
    "database": "ANALYTICS",
    "schema": "PUBLIC",
    "role": "DATACURRENT_MONITOR"
  }
}
```

The connector applies the `datacurrent` query tag, an eight-second login timeout, a fifteen-second network timeout, and a fifteen-second statement timeout.

## Validate

1. Use **Connections → Test connection** and confirm the returned region, role, and server version.
2. Confirm the role can read `SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY`.
3. Wait for the account-usage latency window before treating a newly executed query as missing.
4. Open Query Explorer and confirm Snowflake fingerprints appear.
5. Use Query Lab on a read-only statement and confirm `EXPLAIN USING JSON` returns a plan.
6. Keep benchmark traffic on the dedicated test connection and warehouse.

## Troubleshooting

- **No recent history:** account usage is not real-time. Verify the query window and role imported privileges.
- **Warehouse suspended:** grant usage and allow the service role to use a warehouse with the desired auto-resume policy.
- **Object not visible:** verify database/schema usage plus current and future table/view grants.
- **Timeout:** test region/account identifiers, network egress, and your Snowflake network policy.

