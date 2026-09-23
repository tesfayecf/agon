---
description: Run Agon server and frontend tests
argument-hint: "[package-or-pattern]"
---

Run the project's tests and summarize results.

```bash
(cd server && go test ./...)
pnpm --dir app test
```

${1:+Restrict to: $1.} For a specific Go package use `(cd server && go test ./$1)`; for a frontend pattern use `pnpm --dir app test -- "$1"`. Read failures, identify root causes, and propose fixes.
