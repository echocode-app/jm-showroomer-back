#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_lib.sh"

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
THROWAWAY_LOOKBOOK_SHOWROOM_ID=""

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

ensure_ephemeral_owner_role() {
  local me_response
  me_response=$(curl -s "${EPHEMERAL_HEADER[@]}" "${BASE_URL}/users/me")
  local user_role
  user_role=$(json_get "$me_response" '.data.role // empty')
  if [[ "$user_role" == "admin" ]]; then
    fail "TEST_DELETE_USER_TOKEN must not be admin for this suite"
  fi
  if [[ "$user_role" == "owner" ]]; then
    return
  fi

  local now
  now=$(now_ns)
  http_request "POST /users/complete-owner-profile (upgrade throwaway owner)" 200 "" \
    -X POST "${EPHEMERAL_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Throwaway ${now}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/throw${now}\"}" \
    "${BASE_URL}/users/complete-owner-profile"
}

seed_ephemeral_user() {
  http_request "POST /auth/oauth (ensure throwaway user exists)" 200 "" \
    -X POST "${JSON_HEADER[@]}" \
    -d "{\"idToken\":\"${TEST_DELETE_USER_TOKEN}\"}" \
    "${BASE_URL}/auth/oauth"

  local deleted_flag
  deleted_flag=$(json_get "$LAST_BODY" '.data.user.isDeleted // false')
  if [[ "$deleted_flag" == "true" ]]; then
    fail "throwaway user is deleted; provide a fresh TEST_DELETE_USER_TOKEN"
  fi
}

LOOKBOOK_ID=""
seed_throwaway_lookbook() {
  ensure_ephemeral_owner_role

  http_request "POST /showrooms/draft (throwaway lookbook seed showroom)" 200 "" \
    -X POST "${EPHEMERAL_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"
  THROWAWAY_LOOKBOOK_SHOWROOM_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  if [[ -z "$THROWAWAY_LOOKBOOK_SHOWROOM_ID" ]]; then
    fail "Failed to parse throwaway lookbook seed showroom id"
  fi

  http_request "POST /lookbooks (throwaway owned lookbook seed)" 201 "" \
    -X POST "${EPHEMERAL_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"imageUrl\":\"https://example.com/lookbook.jpg\",\"showroomId\":\"${THROWAWAY_LOOKBOOK_SHOWROOM_ID}\",\"description\":\"delete-block test\"}" \
    "${BASE_URL}/lookbooks"
  LOOKBOOK_ID=$(json_get "$LAST_BODY" '.data.lookbook.id // .data.lookbook.lookbookId // empty')
  if [[ -z "$LOOKBOOK_ID" ]]; then
    LOOKBOOK_ID=$(json_get "$LAST_BODY" '.data.lookbook.id // empty')
  fi
  if [[ -z "$LOOKBOOK_ID" ]]; then
    fail "Failed to parse created lookbook id"
  fi

  http_request "DELETE /showrooms/:id (remove throwaway showroom; keep lookbook blocker)" 200 "" \
    -X DELETE "${EPHEMERAL_HEADER[@]}" \
    "${BASE_URL}/showrooms/${THROWAWAY_LOOKBOOK_SHOWROOM_ID}"
}

delete_throwaway_lookbook() {
  http_request "DELETE /lookbooks/:id (cleanup throwaway lookbook)" 200 "" \
    -X DELETE "${EPHEMERAL_HEADER[@]}" \
    "${BASE_URL}/lookbooks/${LOOKBOOK_ID}"
}

seed_and_delete_throwaway_showroom() {
  ensure_ephemeral_owner_role

  http_request "POST /showrooms/draft (throwaway seed)" 200 "" \
    -X POST "${EPHEMERAL_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  local showroom_id
  showroom_id=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  if [[ -z "$showroom_id" ]]; then
    fail "Failed to parse throwaway showroom id"
  fi

  http_request "DELETE /showrooms/:id (throwaway cleanup)" 200 "" \
    -X DELETE "${EPHEMERAL_HEADER[@]}" \
    "${BASE_URL}/showrooms/${showroom_id}"
}

seed_ephemeral_user

print_section "Delete blocked for throwaway user with lookbook ownership"
seed_throwaway_lookbook
http_request "DELETE /users/me (throwaway blocked by lookbook)" 409 "USER_DELETE_BLOCKED" \
  -X DELETE "${EPHEMERAL_HEADER[@]}" \
  "${BASE_URL}/users/me"
delete_throwaway_lookbook

print_section "Delete allowed when throwaway owns only deleted showrooms"
seed_and_delete_throwaway_showroom

print_section "Delete throwaway user"
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

print_section "Deleted throwaway user cannot write showroom/device/favorite state"
http_request "POST /showrooms/draft (throwaway deleted)" 404 "USER_NOT_FOUND" \
  -X POST "${EPHEMERAL_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

http_request "POST /showrooms/:id/favorite (throwaway deleted)" 404 "USER_NOT_FOUND" \
  -X POST "${EPHEMERAL_HEADER[@]}" \
  "${BASE_URL}/showrooms/any-showroom-id/favorite"

http_request "POST /users/me/devices (throwaway deleted)" 404 "USER_NOT_FOUND" \
  -X POST "${EPHEMERAL_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"deviceId":"dev-delete-test","fcmToken":"token-delete-test","platform":"ios","appVersion":"1.0.0","locale":"en"}' \
  "${BASE_URL}/users/me/devices"

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
