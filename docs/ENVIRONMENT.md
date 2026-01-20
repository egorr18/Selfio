# Environment-specific configuration (Selfio)

## Common variables
Backend uses environment variables:

- `PORT` (default 8080)
- `DATABASE_URL` (recommended) OR:
    - `POSTGRES_HOST`
    - `POSTGRES_PORT`
    - `POSTGRES_DB`
    - `POSTGRES_USER`
    - `POSTGRES_PASSWORD`

Optional:
- `SWAGGER_HOST`
- `SENTRY_DSN`
- `SENTRY_ENV`
- `SENTRY_RELEASE`

---

## Dev (Docker, local)
Use `.env.docker` (loaded by docker compose).

Example:
- POSTGRES_DB=selfio_db
- POSTGRES_USER=selfio
- POSTGRES_PASSWORD=selfio_pass
- POSTGRES_HOST=selfio-postgres
- POSTGRES_PORT=5432
- PORT=8080

Run:
- `docker compose up -d --build`

---

## Dev (Local run without Docker)
Use local `.env` (DO NOT commit it).

Example:
- POSTGRES_HOST=localhost
- POSTGRES_PORT=5432
- POSTGRES_DB=selfio_db
- POSTGRES_USER=selfio
- POSTGRES_PASSWORD=selfio_pass
- PORT=8080

Run:
- `go run ./cmd/server`

---

## Prod
No `.env` files in repo.
Set variables in hosting provider settings (Render / VPS / etc.).
At minimum:
- DATABASE_URL (preferred) or POSTGRES_* vars
- PORT
  Optional:
- SWAGGER_HOST
- SENTRY_*
