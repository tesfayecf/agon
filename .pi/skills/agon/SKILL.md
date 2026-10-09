---
name: agon
description: Agon repo conventions for Go backend and React/Vite frontend. Use when adding features, endpoints, parsing FIT/TCX activity files, or running project checks.
---

# Agon conventions

Agon is a Go-backed React app for uploading and inspecting FIT/TCX activity files.

## Architecture

- Backend: Go 1.24, stdlib-first, module `github.com/tesfayecf/agon/server`, entry `server/cmd/api`.
- Frontend: React 19 + Vite 6 + TypeScript + TanStack Query + React Router, pnpm, under `app/`.
- Frontend proxies `/api` to `http://localhost:8080` in dev.

## Frontend rules

- Product behavior goes in `app/src/features/<feature>/` first. Promote to `shared/` only when multiple features need it.
- API transport lives in `shared/api`; endpoint services live beside the owning feature (e.g. `features/activity/activity.service.ts`).
- Tests: `*.test.ts(x)` run with Vitest (`pnpm --dir app test`).
- Validate with `pnpm --dir app lint`, `pnpm --dir app typecheck`, `pnpm --dir app build`.

## Backend rules

- stdlib-first; add a framework only with concrete justification.
- Packages under `server/internal/`: `activities` (FIT/TCX parsing + analytics), `config`, `httpapi`, `planning`, `storage`, `sqlite`.
- Tests live beside the package as `*_test.go`; run with `(cd server && go test ./...)`.
- Health: `GET /api/health/live` (liveness), `GET /api/health/ready` (readiness).
- Uploads: `POST /api/activities/upload`, multipart `files`, `.fit`/`.tcx` only. Return one result per file; a failed file yields an error result and HTTP 400 while preserving other results.
- FIT via `github.com/tormoder/fit`; TCX via `encoding/xml`.
- Optional SQLite (`SQLITE_PATH`) under `server/internal/sqlite/` with WAL, migrations, backups, corrupt-file quarantine. The current upload flow is in-memory and not persisted.

## Validation before finishing

```bash
pnpm --dir app lint
pnpm --dir app typecheck
pnpm --dir app build
(cd server && go test ./...)
```

## Running locally

`./cmd/agon.sh` runs backend (:8080) + frontend (:3000) together. (README still calls this `cmd/dev.sh`.) Use `GO_BIN=/absolute/path/to/go ./cmd/agon.sh` if `go` is off PATH.

## Avoid

- Do not commit `.tmp`, `.garage`, `.sqlite`, `.go`, or `/backups` — they are gitignored working artifacts.
- Do not bypass per-file error handling on uploads; preserve successful results alongside failures.
