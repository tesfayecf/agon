# Agon project context

You are working on **Agon**, a Go-backed React app for uploading and inspecting FIT/TCX
activity files. Files are parsed on the server; activity metadata plus representative
GPS, speed, distance, timestamp, and heart-rate records are displayed in the browser.

## Tech stack

- Backend: Go 1.24 (stdlib-first), module `github.com/tesfayecf/agon/server`, entrypoint `server/cmd/api`.
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
  cmd/mcp/     MCP stdio server (JSON-RPC over stdin/stdout)
  internal/
    activities/  FIT/TCX parsing, normalized records, analytics
    config/      env-driven config
    httpapi/     routes, middleware, HTTP tests
    mcp/         Model Context Protocol layer (resources + tools)
    planning/    planning store
    storage/     storage abstraction
    sqlite/      optional SQLite infrastructure
    trainingplan/ AI-generated training plan store
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

## MCP (Model Context Protocol)

An MCP server exposes training data and plan-generation tools to AI assistants
(Claude Desktop, GitHub Copilot, VS Code extensions, pi). It runs **inside the
API server** over Streamable HTTP — same DB connection as the REST API.

- **HTTP transport (primary)**: `POST /api/mcp` (plain JSON, or SSE when `Accept: text/event-stream`); legacy SSE discovery on `GET /api/mcp`. Protocol versions 2024-11-05 / 2025-03-26 / 2025-06-18.
- **stdio fallback**: `cmd/mcp-run.sh` (builds `server/cmd/mcp`); registered as `agon-training` in `.vscode/mcp.json` for stdio-only clients. HTTP configs live in `.vscode/mcp.json` (`type: http`), `.cursor/mcp.json`, and `~/.config/Claude/claude_desktop_config.json`.
- **Requirement**: the API server must be running (`./cmd/agon.sh`) with SQLite enabled for MCP resources/tools to return data (`/api/mcp`).
- **Resources** (`agon://` URIs): `activities`, `activities/{id}`, `analytics/summary`, `analytics/weekly-trend`, `analytics/monthly-trend`, `analytics/personal-bests`, `goals`, `schedule/template`, `schedule/planned`, `training-plans`, `training-plans/{id}`.
- **Tools**: `generate_training_plan`, `create_goal`, `create_planned_session`, `update_schedule_template`, `update_plan_status`.
- **Rest API**: `GET/POST /api/training-plans`, `GET/DELETE /api/training-plans/{id}`, `PUT /api/training-plans/{id}/status`.
- Plan sessions use `weekNumber` (1-based) and `dayOfWeek` (0=Monday .. 6=Sunday).

Design report: `docs/mcp-trainingplan-design.md`. Client setup: `.github/copilot-instructions.md`.

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
