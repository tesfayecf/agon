# Agon

Agon is a Go-backed React application for uploading and inspecting FIT and TCX activity files. It parses uploaded files on the server and displays activity metadata plus representative GPS, speed, distance, timestamp, and heart-rate records in the browser.

## What is included

- Go API under `server/` with explicit config loading, health endpoints, request logging, graceful shutdown, multipart activity uploads, FIT parsing, TCX parsing, and HTTP tests.
- React + Vite app under `app/` with React Router, React Query, a typed API client, a `/api` dev proxy, and an activity upload/detail interface at `/upload`.
- FIT decoding through `github.com/tormoder/fit` and TCX decoding through Go's standard XML library.
- Optional SQLite infrastructure under `server/internal/sqlite/` with WAL mode, migrations, integrity checks, backups, and corrupt-file quarantine. It is enabled only when `SQLITE_PATH` is set.
- Root VS Code tasks for local development, builds, linting, typechecking, and tests.
- Shell helpers in `cmd/` for local development and optional SQLite or Garage workflows.

## Quick start

1. Install Go 1.23+, Node 22.14+, and pnpm 10.6.1.
2. Install frontend dependencies with `pnpm --dir app install`.
3. Start the stack with `./cmd/dev.sh`.

If `go` is not available on `PATH`, point the helper script at a local binary:

```bash
GO_BIN=/absolute/path/to/go ./cmd/dev.sh
```

You can also run each side independently:

```bash
cd server && go run ./cmd/api
pnpm --dir app dev
```

Open `http://localhost:3000/upload` to use the activity inspector. The frontend proxies `/api` to `http://localhost:8080` during local development.

Select one or more `.fit` or `.tcx` files. Each file is uploaded to the Go API, parsed server-side, and returned as structured JSON. Successfully parsed files appear in the list and can be selected to inspect their records. A failed file is reported individually without hiding other upload results.

To build and run the application as a single container with Nginx serving the frontend and proxying the API, see [docker/README.md](docker/README.md):

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Structure

```text
app/
	src/
		app/         # bootstrap, router, shared app shell
		features/
			activity/  # FIT/TCX upload UI and API service
			health/    # API health status view
		shared/      # truly cross-cutting code only
server/
	cmd/api/       # application entrypoint
	internal/
		activities/  # FIT and TCX parsing and normalized activity records
		config/      # environment and runtime configuration
		httpapi/     # routes, middleware, and HTTP tests
		sqlite/      # optional SQLite infrastructure
cmd/
	dev.sh         # run backend + frontend together
	sqlite.sh      # lightweight sqlite3 wrapper
	garage.sh      # optional Garage passthrough helper
```

## API

- `GET /api/health/live` returns the liveness status.
- `GET /api/health/ready` returns the readiness status.
- `POST /api/activities/upload` accepts one or more multipart files under the `files` field. Supported extensions are `.fit` and `.tcx`.

The upload response contains one result per submitted file. Successful results include normalized activity metadata and records. Unsupported, malformed, or otherwise unparseable files return an error result and cause the request to use HTTP `400` while preserving the other per-file results.

## Conventions

- Put product behavior in `app/src/features` first. Promote code to `shared` only when multiple features truly need it.
- Keep API transport in `shared/api` and endpoint services beside their owning feature.
- Keep the backend stdlib-first until concrete pressure justifies adding a framework.
- Use `/api/health/live` and `/api/health/ready` for backend health checks.
- Use the root VS Code tasks `workspace:dev` and `workspace:check` when working from the repo root.

## Validation

Run the full project checks with:

```bash
pnpm --dir app lint
pnpm --dir app typecheck
pnpm --dir app build
(cd server && go test ./...)
```

The server tests cover health endpoints, CORS behavior, malformed JSON, successful TCX upload parsing, unsupported file types, and malformed FIT files.

## Optional local services

- `./cmd/sqlite.sh` opens a local SQLite database at `server/.tmp/app.db` by default.
- `./cmd/garage.sh` forwards arguments to a local Garage binary when you need object storage during development.

To enable the optional application SQLite package, set `SQLITE_PATH` in `server/.env`. The current activity upload flow processes files in memory and does not persist uploaded activities to SQLite.
