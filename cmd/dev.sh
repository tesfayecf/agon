#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GO_BIN="${GO_BIN:-go}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

if ! command -v "${GO_BIN}" >/dev/null 2>&1; then
    echo "Go binary not found: ${GO_BIN}" >&2
    echo "Install Go or run with GO_BIN=/absolute/path/to/go ./cmd/dev.sh" >&2
    exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm is required but was not found on PATH." >&2
    exit 1
fi

cleanup() {
    local exit_code=$?

    if [[ -n "${api_pid:-}" ]]; then
        kill "${api_pid}" >/dev/null 2>&1 || true
    fi

    if [[ -n "${web_pid:-}" ]]; then
        kill "${web_pid}" >/dev/null 2>&1 || true
    fi

    wait >/dev/null 2>&1 || true
    exit "${exit_code}"
}

trap cleanup EXIT INT TERM

echo "Starting API server..."
(
    cd "${ROOT_DIR}/server"
    "${GO_BIN}" run ./cmd/api
) &
api_pid=$!

echo "Starting web app on port ${FRONTEND_PORT}..."
(
    cd "${ROOT_DIR}/app"
    pnpm dev -- --host --port "${FRONTEND_PORT}"
) &
web_pid=$!

wait -n "${api_pid}" "${web_pid}"