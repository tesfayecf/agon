# AGENTS.md

Repo-level instructions for AI coding agents working on **Agon**.
Read this before making changes.

## What this project is

Agon is a Go-backed React application for uploading and inspecting FIT and TCX
activity files. Files are parsed on the server; activity metadata plus representative
GPS, speed, distance, timestamp, altitude, and heart-rate records are rendered in the
browser. Product intent lives in `docs/PRDs/` (timestamped filenames); read the latest
before large feature work.

## Tech stack

- **Backend**: Go 1.24 (stdlib-first), module `example.com/app-template/server`, entrypoint `server/cmd/api/main.go`. HTTP via `net/http` `ServeMux` with method-pattern routes (`"GET /api/..."`). FIT decoding via `github.com/tormoder/fit`; TCX via `encoding/xml`.
- **Frontend**: React 19 + Vite 6 + TypeScript, React Router 7, TanStack Query 5. Managed with pnpm (`pnpm@10.6.1`) under `app/`. Tests via Vitest.
- **Optional infra**: SQLite (WAL, migrations, backups, corrupt-file quarantine) under `server/internal/sqlite/`, enabled only when `SQLITE_PATH` is set. S3/Garage object storage under `server/internal/storage/` (with local fallback) and `cmd/garage.sh`.

## Layout

```text
app/src/
  app/         bootstrap, router, AppShell, AppProviders
  features/    activity, health, goals, calendar, schedule, settings, dashboard
  shared/      components, hooks, styles, api (transport), utils, theme
server/
  cmd/api/                 application entrypoint (main.go)
  internal/
    activities/            FIT/TCX parsing, normalized records, analytics
    config/               env-driven config (config.Load)
    httpapi/               routes, middleware (logging, CORS), HTTP tests
    planning/              planning store
    storage/               storage abstraction (S3 + local fallback)
    sqlite/                optional SQLite infrastructure
cmd/
  agon.sh      run backend + frontend together (README still calls this dev.sh)
  sqlite.sh    sqlite3 wrapper for server/.tmp/app.db
  garage.sh    local Garage passthrough
docs/
  PRDs/        product requirement docs (timestamped filenames)
  screenshots/ per-iteration UI screenshots
config/
  garage.toml  local Garage config
```

## API surface

- `GET /api/health/live` — liveness.
- `GET /api/health/ready` — readiness.
- `GET /api/dashboard` — aggregated dashboard data, including `endurance` (non-interval runs) and `intervals` (labelled interval sessions: per-session reps/fade, rep pace by rep length, weekly work time) used by the dashboard's Endurance and Intervals tabs (`server/internal/activities/insights.go`), and `racePredictor` (VDOT-based race-time predictions, effort-adjusted with heart rate when the profile has resting and max HR; `server/internal/activities/racepredictor.go`).
- `GET /api/profile` / `PUT /api/profile` — the athlete's physical metrics (height, weight, birth date, sex, resting/max heart rate; all optional, `0`/`""` = unset) plus derived age, BMI, estimated max HR and HR reserve. Implausible values return `400`. Stored in a single-row SQLite table (`server/internal/profile/`).
- `GET /api/activities` — list activities.
- `GET /api/activities/{id}` — activity detail.
- `PUT /api/activities/{id}` — update activity metadata (name, description, tags, …).
- `DELETE /api/activities/{id}` — delete an activity.
- `PUT /api/activities/{id}/workout` — set the workout type (`easy|long|tempo|hills|intervals|race|other`) and, for `intervals`, a manually specified interval list. Each interval is `kind` (`warmup|work|recovery|cooldown`), `basis` (`time`: seconds, or `distance`: meters), `start`, `length` and optional `label`. Time range, distance, pace and heart rate are derived server-side from the pace/heart-rate profile. Validation errors return `400`. The same operation is exposed to MCP as `set_activity_workout` (read current values from `agon://activities/{id}/workout`).
- `POST /api/activities/upload` — multipart upload under the `files` field. `.fit` and `.tcx` only. Returns one result per file. Unsupported/malformed files return an error result and cause HTTP `400` while preserving the other per-file results. Do not drop successful results when one file fails.
- Analytics and planning routes are registered in `httpapi/analytics_routes.go` and `httpapi/planning_routes.go`.

The frontend dev server proxies `/api` to `http://localhost:8080`.

## Conventions (follow these)

### General

- Prefer reading `docs/PRDs/` for product intent and the existing code for current behavior before large changes.
- Keep changes minimal and focused. Match existing style rather than reformatting untouched code.
- Do not commit working artifacts: `.tmp`, `.garage`, `.sqlite`, `.go`, and `/backups` are gitignored.

### Frontend (`app/`)

- Put product behavior in `app/src/features/<feature>/` first. Promote code to `shared/` only when multiple features truly need it.
- Keep API transport in `app/src/shared/api` (`client.ts`, `errors.ts`, `queryClient.ts`). Put endpoint services beside their owning feature (e.g. `features/activity/activity.service.ts`).
- Tests: `*.test.ts(x)` run with Vitest.
- Validate with `pnpm --dir app lint`, `pnpm --dir app typecheck`, `pnpm --dir app build`.

### Backend (`server/`)

- Stay stdlib-first; add a framework only with concrete justification.
- Packages live under `server/internal/`. Keep the import boundary `internal/` — do not expose packages that callers outside the module would need.
- Config comes from the environment via `config.Load()` (see `server/.env.example`). Do not invent config sources; add new keys there and document them.
- HTTP routes use Go 1.22+ method patterns on `http.ServeMux`. Middleware order in `httpapi.NewServer`: `LoggingMiddleware(CORSMiddleware(mux))`.
- CORS is origin-allow-list based (`CORS_ALLOWED_ORIGINS`). Preserve the `Vary` header behavior.
- Tests live beside the package as `*_test.go`; run with `(cd server && go test ./...)`. HTTP tests cover health, CORS, malformed JSON, TCX upload parsing, unsupported types, and malformed FIT — keep that coverage and extend it for new endpoints.

## Validation (run before declaring work done)

```bash
pnpm --dir app lint
pnpm --dir app typecheck
pnpm --dir app build
(cd server && go test ./...)
```

This mirrors the root VS Code task `workspace:check`. `workspace:dev` runs backend and frontend in parallel. Do not claim a task is complete if any step fails; read the failures, fix the root cause, and re-run.

## Running locally

```bash
./cmd/agon.sh            # backend (:8080) + frontend (:3000) together
# or independently:
(cd server && go run ./cmd/api)
pnpm --dir app dev
```

If `go` is not on PATH: `GO_BIN=/absolute/path/to/go ./cmd/agon.sh`. Open `http://localhost:3000/upload`.

Optional SQLite: set `SQLITE_PATH` in `server/.env` (see `server/.env.example`). The current upload flow is in-memory and not persisted unless you wire it up.

## Environment variables (server)

From `server/.env.example`: `APP_ENV`, `HTTP_ADDR`, `HTTP_READ_HEADER_TIMEOUT`, `HTTP_READ_TIMEOUT`, `HTTP_WRITE_TIMEOUT`, `HTTP_IDLE_TIMEOUT`, `CORS_ALLOWED_ORIGINS`, `SQLITE_PATH`, `SQLITE_BACKUP_DIR`, plus S3 settings (`S3_*`) when object storage is used. See `server/internal/config/config.go` for the full list.

## Environment variables (frontend)

From `app/.env.example`: `VITE_APP_NAME`, `VITE_API_BASE_URL` (default `/api`), `VITE_API_PROXY_TARGET` (default `http://localhost:8080`).

## Notes for agents

- The README references `./cmd/dev.sh`; the actual helper is `./cmd/agon.sh`.
- Do not bypass per-file error handling on uploads — preserving successful results alongside failures is a product requirement.
- When unsure about scope, check the relevant PRD in `docs/PRDs/` before implementing.
