# Agon project context

You are working on **Agon**, a Go-backed React app for uploading and inspecting FIT/TCX
activity files. Files are parsed on the server; activity metadata plus representative
GPS, speed, distance, timestamp, and heart-rate records are displayed in the browser.

## Tech stack

- Backend: Go 1.24 (stdlib-first), module `example.com/app-template/server`, entrypoint `server/cmd/api`.
  FIT decoding via `github.com/tormoder/fit`; TCX via `encoding/xml`.
- Frontend: React 19 + Vite 6 + TypeScript, React Router 7, TanStack Query 5. Managed with pnpm (`pnpm@10.6.1`) under `app/`. Tests via Vitest.
- Optional infra: SQLite (WAL, migrations, quarantine) under `server/internal/sqlite/`, enabled only when `SQLITE_PATH` is set; S3/Garage object storage helpers under `config/` and `cmd/garage.sh`.

## Layout

```text
app/src/
  app/         bootstrap, router, AppShell, AppProviders
  features/    activity, health, goals, calendar, schedule, settings, dashboard
  shared/      components, api (transport), truly cross-cutting code only
server/
  cmd/api/     application entrypoint (main.go)
  internal/
    activities/  FIT/TCX parsing, normalized records, analytics
    config/      env-driven config
    httpapi/     routes, middleware, HTTP tests
    planning/    planning store
    storage/     storage abstraction
    sqlite/      optional SQLite infrastructure
cmd/
  agon.sh      run backend + frontend together (README still calls this dev.sh)
  sqlite.sh    sqlite3 wrapper for server/.tmp/app.db
  garage.sh    local Garage passthrough
docs/
  PRDs/        product requirement docs (timestamped filenames)
  screenshots/ per-iteration UI screenshots
```

## Conventions (follow these)

- Put product behavior in `app/src/features` first. Promote to `shared` only when multiple features truly need it.
- Keep API transport in `shared/api`; put endpoint services beside their owning feature.
- Keep the backend stdlib-first until concrete pressure justifies a framework.
- Health checks: `GET /api/health/live` (liveness), `GET /api/health/ready` (readiness).
- Uploads: `POST /api/activities/upload` with multipart `files` field, `.fit` and `.tcx` only. Per-file results; unsupported/malformed files return an error result and HTTP 400 while preserving other results.
- Frontend dev server proxies `/api` to `http://localhost:8080`.
- Add Go tests beside the package as `*_test.go`; frontend tests as `*.test.ts(x)`.

## Validation (run before declaring work done)

```bash
pnpm --dir app lint
pnpm --dir app typecheck
pnpm --dir app build
(cd server && go test ./...)
```

The root VS Code task `workspace:check` runs frontend lint + typecheck + build then server tests in sequence. `workspace:dev` runs the backend and frontend in parallel.

## Running locally

```bash
./cmd/agon.sh            # backend (server, :8080) + frontend (app, :3000)
# or independently:
(cd server && go run ./cmd/api)
pnpm --dir app dev
```

If `go` is not on PATH: `GO_BIN=/absolute/path/to/go ./cmd/agon.sh`. Open `http://localhost:3000/upload`.

Optional SQLite: set `SQLITE_PATH` in `server/.env` (current upload flow is in-memory; not persisted).

## Notes

- `./cmd/dev.sh` referenced in README is actually `./cmd/agon.sh`.
- `.tmp`, `.garage`, `.sqlite`, `.go`, and `/backups` are gitignored working artifacts — do not commit them.
- Prefer reading `docs/PRDs/` for product intent before large feature work.
