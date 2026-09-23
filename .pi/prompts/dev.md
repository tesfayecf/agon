---
description: Start the Agon dev stack (backend on :8080, frontend on :3000)
argument-hint: "[frontend-port]"
---

Start the local Agon dev stack. The backend API runs on port 8080 and the Vite dev server proxies `/api` to it. The frontend opens on port 3000 by default.

Use the helper script:

```bash
${1:+FRONTEND_PORT=$1 }./cmd/agon.sh
```

This is a long-running background process. Launch it in the background, wait for both the Go server (`:8080`) and the Vite server (`:3000`) to report they are ready, then report the URLs the user can open (e.g. `http://localhost:3000/upload`). If `go` is missing from PATH, suggest re-running with `GO_BIN=/absolute/path/to/go`.
