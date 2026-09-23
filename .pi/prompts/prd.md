---
description: Read and summarize the latest Agon PRD under docs/PRDs
argument-hint: "[filename-or-topic]"
---

Look in `docs/PRDs/` for product requirement documents (filenames are timestamps like `202609121118.md`).

${1:+If an argument is given, find the PRD whose filename or contents match "$1". Otherwise,} read the most recent PRD (highest timestamp filename) and:

1. Summarize its goal, scope, and any explicit acceptance criteria.
2. List the affected areas of the codebase (which `app/src/features/*`, `server/internal/*`, or endpoints will change).
3. Call out anything that conflicts with existing conventions in this repo.
4. Propose a concrete implementation plan with validation steps (`pnpm --dir app lint/typecheck/build`, `go test ./...`).

Do not start editing until the plan is confirmed.
