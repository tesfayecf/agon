#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GARAGE_BIN="${GARAGE_BIN:-${ROOT_DIR}/third-party/garage/garage}"
GARAGE_CONFIG="${GARAGE_CONFIG:-${ROOT_DIR}/config/garage.toml}"

if [[ ! -x "${GARAGE_BIN}" ]]; then
	echo "Garage binary not found at ${GARAGE_BIN}." >&2
	echo "Set GARAGE_BIN or place the binary under third-party/garage/garage." >&2
	exit 1
fi

if [[ ! -f "${GARAGE_CONFIG}" ]]; then
	echo "Garage config not found at ${GARAGE_CONFIG}." >&2
	exit 1
fi

if [[ $# -eq 0 ]]; then
	cat <<'EOF'
Usage: ./cmd/garage.sh <garage arguments>

Examples:
  ./cmd/garage.sh server
  ./cmd/garage.sh status
  ./cmd/garage.sh key create local-dev
EOF
	exit 1
fi

exec "${GARAGE_BIN}" -c "${GARAGE_CONFIG}" "$@"
