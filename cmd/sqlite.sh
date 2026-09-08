#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${DB_PATH:-${ROOT_DIR}/server/.tmp/app.db}"

if ! command -v sqlite3 >/dev/null 2>&1; then
	echo "sqlite3 is required but was not found on PATH." >&2
	exit 1
fi

mkdir -p "$(dirname "${DB_PATH}")"

if [[ $# -eq 0 ]]; then
	cat <<EOF
Usage: ./cmd/sqlite.sh '<sql>'

Database: ${DB_PATH}

Examples:
  ./cmd/sqlite.sh '.tables'
  ./cmd/sqlite.sh 'select 1;'
EOF
	exit 1
fi

exec sqlite3 "${DB_PATH}" "$@"
