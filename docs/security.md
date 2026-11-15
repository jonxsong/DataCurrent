# Security model

DataCurrent treats database access as sensitive infrastructure access. The defaults optimize for least privilege and explicit failure.

## Enforced controls

- **Credential isolation:** connection payloads use secret types, are encrypted with Fernet before persistence, and are never returned by API schemas.
- **Tenant boundaries:** every workspace API requires membership; administrative connection actions require elevated roles.
- **Network policy:** host validation blocks unsafe targets unless explicitly allowlisted for a controlled deployment.
- **Read-only SQL:** SQLGlot parsing permits a single query expression and rejects mutation, transaction, and multi-statement input.
- **Bounded execution:** connector login, network, statement, and application request timeouts are finite.
- **AI minimization:** the agent sees redacted SQL and selected evidence—not connection configuration, passwords, or arbitrary source rows.
- **Prompt-injection handling:** all database text and tool output is classified as untrusted data in the investigator policy.
- **Human authority:** proposed SQL is never executed as a schema change and benchmark submission is a separate operator action.
- **Session security:** Argon2 password hashing, signed JWT sessions, and `HttpOnly` cookies.
- **Browser policy:** content-type, referrer, and permissions headers are set by the web runtime.

## Production requirements

Set unique values through your secret manager for `DATACURRENT_SECRET_KEY`, `DATACURRENT_ENCRYPTION_KEY`, database credentials, and `OPENAI_API_KEY`. Use TLS at the edge and between services where the network is not trusted. Do not reuse the Compose development credentials.

The encryption key must be a URL-safe Fernet key and must be backed up independently. Losing it makes stored source configurations unrecoverable; rotating it requires decrypting and re-encrypting each configuration in a controlled migration.

## Database roles

Use a dedicated collection role for every source. Create a second dedicated role and connection for benchmarks. Never grant either role schema mutation in production. DataCurrent's benchmark engine also checks the `benchmark_only` flag, but database privileges remain the authoritative control.

## Reporting

Do not include credentials, complete query literals, or source row data in issue reports. Include request IDs, sanitized error codes, provider/version, and the smallest redacted reproduction.

