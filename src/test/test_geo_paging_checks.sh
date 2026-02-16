#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"
# shellcheck source=./helpers/geo_paging_suite.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/helpers/geo_paging_suite.sh"

load_env
require_cmd curl jq
require_env TEST_USER_TOKEN TEST_ADMIN_TOKEN

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
TEST_USER_TOKEN="${TEST_USER_TOKEN//$'\r'/}"
TEST_ADMIN_TOKEN="${TEST_ADMIN_TOKEN//$'\r'/}"
# shellcheck disable=SC2034 # Consumed by sourced helper functions.
AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
# shellcheck disable=SC2034 # Consumed by sourced helper functions.
ADMIN_HEADER=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")
# shellcheck disable=SC2034 # Consumed by sourced helper functions.
JSON_HEADER=(-H "$(json_header)")

guard_prod_write "${BASE_URL}"

run_geo_paging_suite
