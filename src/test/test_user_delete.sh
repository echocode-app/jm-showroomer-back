#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq
require_env TEST_OWNER_TOKEN_2 TEST_DELETE_USER_TOKEN

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
JSON_HEADER=(-H "$(json_header)")
warn_if_prod_write "${BASE_URL}"
guard_prod_write "${BASE_URL}"

EPHEMERAL_HEADER=(-H "$(auth_header "${TEST_DELETE_USER_TOKEN}")")

print_section "Delete throwaway user (no assets)"
http_request "DELETE /users/me (throwaway)" 200 "" \
  -X DELETE "${EPHEMERAL_HEADER[@]}" \
  "${BASE_URL}/users/me"

print_section "Deleted throwaway user cannot access profile"
http_request "GET /users/me (throwaway deleted)" 404 "USER_NOT_FOUND" \
  "${EPHEMERAL_HEADER[@]}" \
  "${BASE_URL}/users/me"

print_section "Delete throwaway user again (idempotent)"
http_request "DELETE /users/me (throwaway again)" 200 "" \
  -X DELETE "${EPHEMERAL_HEADER[@]}" \
  "${BASE_URL}/users/me"

print_section "Seed showroom (active asset)"
OWNER_HEADER=(-H "$(auth_header "${TEST_OWNER_TOKEN_2}")")
http_request "POST /auth/oauth (ensure owner2 user exists)" 200 "" \
  -X POST "${JSON_HEADER[@]}" \
  -d "{\"idToken\":\"${TEST_OWNER_TOKEN_2}\"}" \
  "${BASE_URL}/auth/oauth"

OWNER2_DELETED=$(json_get "$LAST_BODY" '.data.user.isDeleted // false')
if [[ "$OWNER2_DELETED" == "true" ]]; then
  fail "owner2 user is deleted; provide a non-deleted TEST_OWNER_TOKEN_2"
fi

http_request "POST /showrooms/draft (owner2 seed)" 200 "" \
  -X POST "${OWNER_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

print_section "Delete blocked for owner with active assets"
http_request "DELETE /users/me (owner2 blocked)" 409 "USER_DELETE_BLOCKED" \
  -X DELETE "${OWNER_HEADER[@]}" \
  "${BASE_URL}/users/me"

print_section "RESULT"
echo "✔ User delete tests passed"
