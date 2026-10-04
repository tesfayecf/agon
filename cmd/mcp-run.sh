#!/usr/bin/env bash
# Launcher for the Agon MCP stdio server.
#
# Used by MCP clients that spawn a process over stdin/stdout:
#   - Claude Desktop (~/.config/Claude/claude_desktop_config.json)
#   - VS Code / GitHub Copilot (.vscode/mcp.json)
#   - Cursor (.cursor/mcp.json)
#
# Behaviour:
#   - cd's into the repo root regardless of the client's working directory
#   - builds server/cmd/mcp on first run (or when Go sources change)
#   - points SQLITE_PATH at the app database so the server shares data
#     with the running API server
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${AGON_MCP_BIN:-$ROOT/server/.tmp/mcp-agon}"

if [[ ! -x "$BIN" ]] || [[ -n "$(find "$ROOT/server" -name '*.go' -newer "$BIN" -print -quit 2>/dev/null)" ]]; then
  mkdir -p "$(dirname "$BIN")"
  (cd "$ROOT/server" && go build -o "$BIN" ./cmd/mcp)
fi

if [[ -n "${AGON_MCP_LOG:-}" ]]; then
  echo "agon mcp: using db=${SQLITE_PATH:-$ROOT/server/.tmp/app.db}" >> "$AGON_MCP_LOG"
fi

export SQLITE_PATH="${SQLITE_PATH:-$ROOT/server/.tmp/app.db}"
exec "$BIN"