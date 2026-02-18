#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq
require_env TEST_USER_TOKEN TEST_DELETE_USER_TOKEN

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
JSON_HEADER=(-H "$(json_header)")
warn_if_prod_write "${BASE_URL}"
guard_prod_write "${BASE_URL}"

EPHEMERAL_HEADER=(-H "$(auth_header "${TEST_DELETE_USER_TOKEN}")")
BLOCKED_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")

if [[ "${TEST_DELETE_USER_TOKEN}" == "${TEST_USER_TOKEN}" ]]; then
  fail "TEST_DELETE_USER_TOKEN must be different from TEST_USER_TOKEN (throwaway and blocked-owner users must be different accounts)"
fi

ensure_blocked_owner_role() {
  local me_response
  me_response=$(curl -s "${BLOCKED_HEADER[@]}" "${BASE_URL}/users/me")
  local user_role
  user_role=$(json_get "$me_response" '.data.role // empty')
  if [[ "$user_role" == "admin" ]]; then
    fail "TEST_USER_TOKEN must be user/owner for this suite (admin token detected)"
  fi
  if [[ "$user_role" == "owner" ]]; then
    return
  fi

  local now
  now=$(now_ns)
  http_request "POST /users/complete-owner-profile (upgrade blocked owner)" 200 "" \
    -X POST "${BLOCKED_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Owner ${now}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner${now}\"}" \
    "${BASE_URL}/users/complete-owner-profile"
}

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
http_request "POST /auth/oauth (ensure blocked user exists)" 200 "" \
  -X POST "${JSON_HEADER[@]}" \
  -d "{\"idToken\":\"${TEST_USER_TOKEN}\"}" \
  "${BASE_URL}/auth/oauth"

BLOCKED_USER_DELETED=$(json_get "$LAST_BODY" '.data.user.isDeleted // false')
if [[ "$BLOCKED_USER_DELETED" == "true" ]]; then
  fail "blocked user is deleted; provide a non-deleted TEST_USER_TOKEN"
fi

ensure_blocked_owner_role

http_request "POST /showrooms/draft (blocked owner seed)" 200 "" \
  -X POST "${BLOCKED_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

print_section "Delete blocked for owner with active assets"
http_request "DELETE /users/me (blocked owner)" 409 "USER_DELETE_BLOCKED" \
  -X DELETE "${BLOCKED_HEADER[@]}" \
  "${BASE_URL}/users/me"

print_section "RESULT"
echo "✔ User delete tests passed"
