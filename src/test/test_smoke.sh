#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"
# shellcheck source=./lib/helpers/smoke_suite.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/helpers/smoke_suite.sh"

load_env
require_cmd curl jq

ENV="${NODE_ENV:-dev}"
BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
guard_prod_write "${BASE_URL}"

run_public_smoke_suite

if [[ -n "${TEST_USER_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
  run_authenticated_smoke_suite "${AUTH_HEADER[@]}"
else
  echo "⚠ TEST_USER_TOKEN not set; skipping authenticated smoke checks"
fi

print_section "RESULT"
echo "✔ Smoke tests passed"
