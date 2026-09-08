# App Template

Opinionated starter for Go backend + React frontend products. The template is optimized for short local feedback loops, minimal framework lock-in on the backend, and a frontend structure that stays readable as features accumulate.

## What is included

- Go API scaffold under `server/` with explicit config loading, health endpoints, request logging, graceful shutdown, and a small handler test suite.
- React + Vite app under `app/` with React Router, React Query, a typed API client, feature service/query-key conventions, a `/api` dev proxy, env examples, and an opinionated `app / features / shared` source layout.
- Optional SQLite infrastructure under `server/internal/sqlite/` with WAL mode, migrations, integrity checks, backups, and corrupt-file quarantine. It is enabled only when `SQLITE_PATH` is set.
- Root VS Code tasks and launch configs for the current workspace instead of the old nested-only setup.
- Shell helpers in `cmd/` for local development and optional SQLite or Garage workflows.

## Quick start

1. Install Go 1.23+, Node 22.14+, and pnpm 10.6.1.
2. Copy the example env files.
3. Update the Go module path in `server/go.mod` for your real repository.
4. Install frontend dependencies with `pnpm --dir app install`.
5. Start the stack with `./cmd/dev.sh`.

If `go` is not available on `PATH`, point the helper script at a local binary:

```bash
GO_BIN=/absolute/path/to/go ./cmd/dev.sh
```

You can also run each side independently:

```bash
cd server && go run ./cmd/api
pnpm --dir app dev
```

Open `http://localhost:3000`. The frontend proxies `/api` to `http://localhost:8080` during local development.

To build and run the application as a single container with Nginx serving the frontend and proxying the API, see [docker/README.md](docker/README.md):

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Structure

```text
app/
	src/
		app/         # bootstrap, router, shared app shell
		features/    # product slices own their UI and data hooks
		shared/      # truly cross-cutting code only
server/
	cmd/api/       # application entrypoint
	internal/
		config/      # environment and runtime configuration
		httpapi/     # handlers, middleware, and HTTP tests
cmd/
	dev.sh         # run backend + frontend together
	sqlite.sh      # lightweight sqlite3 wrapper
	garage.sh      # optional Garage passthrough helper
```

## Conventions

- Put product behavior in `app/src/features` first. Promote code to `shared` only when multiple features truly need it.
- Keep API transport in `shared/api`, endpoint services and query keys beside their owning feature, and use the shared `QueryClient`.
- Keep the backend stdlib-first until concrete pressure justifies adding a framework.
- Treat `/api/healthz` as the first integration seam; the starter app already exercises it.
- Use the root VS Code tasks `workspace:dev` and `workspace:check` when working from the repo root.

## Optional local services

- `./cmd/sqlite.sh` opens a local SQLite database at `server/.tmp/app.db` by default.
- `./cmd/garage.sh` forwards arguments to a local Garage binary when you need object storage during development.

To enable the optional application SQLite package, set `SQLITE_PATH` in `server/.env`. Supply app-specific migrations to `sqlite.Migrate`; the template does not impose a product schema.
