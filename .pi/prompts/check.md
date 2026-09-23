---
description: Run the full Agon validation suite (frontend lint/typecheck/build + server tests)
argument-hint: "[focus]"
---

Run the complete project validation suite and report results. Do not declare the work done until every step passes.

Run, in order:

```bash
pnpm --dir app lint
pnpm --dir app typecheck
pnpm --dir app build
(cd server && go test ./...)
```

If anything fails, read the failures, fix the underlying cause (not just the symptom), and re-run the failing step plus everything after it. Summarize each step's outcome at the end. ${1:+Focus extra attention on: $1.}
