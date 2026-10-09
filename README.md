# Agon

A self-hosted training log and activity inspector for runners and cyclists.
Upload `.fit` and `.tcx` files, and Agon parses them on a Go server to serve
GPS tracks, splits, interval analysis, training-load trends, race predictions,
goals, a calendar, and AI-assisted training plans over MCP.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

**Activity files**
- Upload one or many `.fit` / `.tcx` files; each file is parsed server-side and reported per-file, so one bad file never hides the others.
- Activity detail with a canvas-rendered GPS track, time-series charts (speed, heart rate, elevation, cadence), split analysis, and run insights (pace distribution, HR zones).
- Interval sessions: manually labelled or auto-derived warmup/work/recovery/cooldown segments with per-rep pace and heart rate.
- Optional SQLite persistence (WAL, migrations, backups, corrupt-file quarantine) enabled via `SQLITE_PATH`.

**Training analytics**
- Dashboard with overview, endurance, and interval tabs; weekly/monthly trends and personal bests.
- Training-load card with zone breakdown.
- Race predictor: VDOT-based race-time predictions, effort-adjusted with heart rate when resting/max HR is set.
- Athlete profile: height, weight, birth date, sex, resting/max heart rate, with derived age, BMI, max HR, and HR reserve.

**Planning**
- Goals with progress rings, a month calendar, week agenda, and a year heatmap.
- Schedule templates and planned sessions.
- Training plans with draft/active/completed status and a plan composer.

**AI integration (MCP)**
- A Model Context Protocol server runs inside the API server over Streamable HTTP (`POST /api/mcp`), exposing your training data as resources and tools (`generate_training_plan`, `create_goal`, `create_planned_session`, and more).
- Works with Claude Desktop, GitHub Copilot, VS Code, Cursor, and any MCP client. A stdio fallback (`cmd/mcp-run.sh`) covers stdio-only clients.

**Interface**
- Light and dark themes, responsive layout, keyboard-friendly controls.

## Quick start

Requires Go 1.24+, Node 22+, and pnpm 10.

```bash
pnpm --dir app install
./cmd/agon.sh              # backend on :8080, frontend on :3000
```

If `go` is not on `PATH`, point the helper at a local binary:

```bash
GO_BIN=/absolute/path/to/go ./cmd/agon.sh
```

Or run each side independently:

```bash
(cd server && go run ./cmd/api)
pnpm --dir app dev
```

Open `http://localhost:3000/upload` and drop in some `.fit` or `.tcx` files. The frontend dev server proxies `/api` to `http://localhost:8080`.

To enable SQLite persistence, set `SQLITE_PATH` in `server/.env` (see `server/.env.example`).

## Docker

A single container serves the built frontend with Nginx and proxies `/api/*` to the Go API:

```bash
docker compose -f docker/docker-compose.yml up --build
```

See [docker/README.md](docker/README.md) for multi-arch builds and API-origin configuration.

## Structure

```text
app/
  src/
    app/         # bootstrap, router, shared app shell
    features/    # activity, dashboard, goals, calendar, schedule, trainingplans, settings, health
    shared/      # components, api transport, styles, theme
server/
  cmd/api/       # application entrypoint
  cmd/mcp/       # MCP stdio fallback entrypoint
  internal/
    activities/  # FIT/TCX parsing, normalized records, analytics, race predictor
    httpapi/     # routes, middleware, HTTP tests
    mcp/         # Model Context Protocol server (resources + tools)
    planning/    # schedule templates and planned sessions
    profile/     # athlete profile store
    trainingplan/# AI-generated training plan store
    sqlite/      # optional SQLite infrastructure
    storage/     # S3/Garage object storage with local fallback
cmd/             # agon.sh (dev), sqlite.sh, garage.sh, mcp-run.sh
docs/            # PRDs and roadmap
```

## API surface

- `GET /api/health/live`, `GET /api/health/ready` — liveness and readiness.
- `POST /api/activities/upload` — multipart upload under the `files` field; one result per file.
- `GET /api/activities`, `GET /api/activities/{id}`, `PUT /api/activities/{id}`, `DELETE /api/activities/{id}`.
- `PUT /api/activities/{id}/workout` — set the workout type and, for intervals, a manual interval list.
- `GET /api/dashboard` — aggregated analytics (endurance, intervals, race predictor, training load).
- `GET/PUT /api/profile` — athlete physical metrics.
- `GET/POST/DELETE /api/training-plans`, `PUT /api/training-plans/{id}/status`.
- Planning routes in `server/internal/httpapi/planning_routes.go`; analytics routes in `analytics_routes.go`.
- `POST /api/mcp` — MCP Streamable HTTP endpoint (also SSE for discovery).

Uploads are strict by design: unsupported or malformed files return an error result with HTTP `400` while preserving every other per-file result.

## Development

Backend stays stdlib-first (`net/http` + `http.ServeMux`, FIT via `github.com/tormoder/fit`, TCX via `encoding/xml`). Frontend is React 19 + Vite 6 + TypeScript with React Router 7, TanStack Query 5, and Vitest.

Run the full project checks:

```bash
pnpm --dir app lint
pnpm --dir app typecheck
pnpm --dir app build
(cd server && go test ./...)
```

Server tests cover health, CORS, malformed JSON, TCX/FIT parsing, unsupported types, workouts, profile, planning, and the MCP layer.

## Optional local services

- `./cmd/sqlite.sh` — sqlite3 wrapper for `server/.tmp/app.db`.
- `./cmd/garage.sh` — passthrough to a local Garage (S3) server for object-storage development. Create your own `config/garage.toml` (gitignored) following [Garage's quickstart](https://garagehq.deuxfleurs.fr/documentation/quickstart/) — never commit real tokens.

## Documentation

- `docs/PRDs/` — product requirement documents.
- `docs/ROADMAP.md` — prioritised feature roadmap.
- `AGENTS.md` — conventions for AI coding agents working in this repo.

## License

[MIT](LICENSE)
