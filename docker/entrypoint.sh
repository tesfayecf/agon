#!/bin/sh

set -eu

/usr/local/bin/api &
backend_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

terminate() {
	kill -TERM "$backend_pid" 2>/dev/null || true
	kill -TERM "$nginx_pid" 2>/dev/null || true
}

trap terminate INT TERM

while :; do
	if ! kill -0 "$backend_pid" 2>/dev/null; then
		break
	fi
	if ! kill -0 "$nginx_pid" 2>/dev/null; then
		break
	fi
	sleep 1
done

terminate
wait "$backend_pid" 2>/dev/null || true
wait "$nginx_pid" 2>/dev/null || true