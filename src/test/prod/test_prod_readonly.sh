#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_lib.sh"

load_env
require_cmd curl jq

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"

print_section "Prod Read-only Smoke"
http_request "GET /health" 200 "" "${BASE_URL}/health"
http_request "GET /showrooms?limit=1" 200 "" "${BASE_URL}/showrooms?limit=1"
request_allow_status_or_index_not_ready "GET /showrooms?city=Kyiv" \
  "${BASE_URL}/showrooms?city=Kyiv&limit=1"

http_request "GET /showrooms/suggestions?q=ky&qMode=city" 200 "" \
  "${BASE_URL}/showrooms/suggestions?q=ky&qMode=city&limit=5"
http_request "GET /showrooms/counters?city=Kyiv" 200 "" \
  "${BASE_URL}/showrooms/counters?city=Kyiv"

request_allow_status_or_index_not_ready "GET /events?limit=5" \
  "${BASE_URL}/events?limit=5"
http_request "GET /lookbooks?country=Ukraine&seasonKey=ss-2026&limit=1" 200 "" "${BASE_URL}/lookbooks?country=Ukraine&seasonKey=ss-2026&limit=1"

print_section "Auth Contract (optional)"
if [[ -n "${PROD_ID_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "$(auth_header "${PROD_ID_TOKEN}")")
  http_request "GET /users/me (auth)" 200 "" \
    "${AUTH_HEADER[@]}" \
    "${BASE_URL}/users/me"
else
  echo "⚠ PROD_ID_TOKEN is not set; skipping authenticated read-only checks"
fi

http_request "GET /collections/want-to-visit/events (unauth guest empty)" 200 "" \
  "${BASE_URL}/collections/want-to-visit/events"

print_section "RESULT"
echo "✔ Prod read-only smoke passed"
