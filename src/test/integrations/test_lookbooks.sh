#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_lib.sh"
# shellcheck source=./lib/helpers/lookbooks_suite.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/helpers/lookbooks_suite.sh"

load_env
require_cmd curl jq node
require_env TEST_USER_TOKEN

# Needed for inline node Firestore writes in lookbooks suite step 7.
ENV_FILE=".env.${NODE_ENV:-dev}"
if [ -f "$ENV_FILE" ]; then
  FIREBASE_PRIVATE_KEY=$(grep -v '^#' "$ENV_FILE" | grep -m1 '^FIREBASE_PRIVATE_KEY=' | cut -d= -f2-)
  FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY#\"}
  FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY%\"}
  export FIREBASE_PRIVATE_KEY
fi

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
guard_prod_write "${BASE_URL}"
warn_if_prod_write "${BASE_URL}"
# shellcheck disable=SC2034 # Consumed by sourced helper functions.
AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
# shellcheck disable=SC2034 # Consumed by sourced helper functions.
JSON_HEADER=(-H "$(json_header)")

run_lookbooks_suite
