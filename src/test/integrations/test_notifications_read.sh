#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_lib.sh"

load_env
require_cmd curl jq node
require_env TEST_USER_TOKEN TEST_ADMIN_TOKEN

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
guard_prod_write "${BASE_URL}"
warn_if_prod_write "${BASE_URL}"

AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
ADMIN_HEADER=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")
NOW=$(now_ns)
SHORT_NOW="${NOW: -6}"

ensure_owner_role() {
  local me_response
  me_response=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  local user_role
  user_role=$(json_get "$me_response" '.data.role // empty')
  if [[ "$user_role" == "owner" ]]; then
    return
  fi

  http_request "POST /users/complete-owner-profile (upgrade for notifications read test)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Owner ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/notifread${NOW}\"}" \
    "${BASE_URL}/users/complete-owner-profile"
}

create_submittable_showroom() {
  local suffix=$1
  local draft_id
  local unique="${SHORT_NOW}${suffix}"

  http_request "POST /showrooms/draft (${suffix})" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  draft_id=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$draft_id" "draft showroom id (${suffix})"

  http_request "PATCH /showrooms/{id} (${suffix})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Notif Read ${unique}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"Kyiv, Notif Read St ${unique}\",\"city\":\"Kyiv\",\"availability\":\"open\",\"brands\":[\"BrandNotifRead${SHORT_NOW}\"],\"contacts\":{\"phone\":\"+380501112233\",\"instagram\":\"https://instagram.com/notifread${SHORT_NOW}${suffix}\"},\"location\":{\"lat\":50.4501,\"lng\":30.5234}}" \
    "${BASE_URL}/showrooms/${draft_id}"

  http_request "PATCH /showrooms/{id} geo (${suffix})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"geo\":{\"city\":\"Kyiv\",\"country\":\"Ukraine\",\"coords\":{\"lat\":50.4501,\"lng\":30.5234},\"placeId\":\"notif-read-place-${unique}\"}}" \
    "${BASE_URL}/showrooms/${draft_id}"

  http_request "POST /showrooms/{id}/submit (${suffix})" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/${draft_id}/submit"

  echo "$draft_id"
}

approve_showroom() {
  local showroom_id=$1
  http_request "POST /admin/showrooms/{id}/approve (${showroom_id})" 200 "" \
    -X POST "${ADMIN_HEADER[@]}" \
    "${BASE_URL}/admin/showrooms/${showroom_id}/approve"
}

print_section "Setup identities"
ensure_owner_role
http_request "GET /users/me (owner)" 200 "" "${AUTH_HEADER[@]}" "${BASE_URL}/users/me"
OWNER_UID=$(json_get "$LAST_BODY" '.data.uid // empty')
assert_non_empty "$OWNER_UID" "owner uid"

http_request "GET /users/me (admin)" 200 "" "${ADMIN_HEADER[@]}" "${BASE_URL}/users/me"
ADMIN_UID=$(json_get "$LAST_BODY" '.data.uid // empty')
assert_non_empty "$ADMIN_UID" "admin uid"

print_section "Create notifications via approve"
SHOWROOM_ID_1=$(create_submittable_showroom "read-1" | tail -n1)
approve_showroom "$SHOWROOM_ID_1"
sleep 1
SHOWROOM_ID_2=$(create_submittable_showroom "read-2" | tail -n1)
approve_showroom "$SHOWROOM_ID_2"
sleep 1
SHOWROOM_ID_3=$(create_submittable_showroom "read-3" | tail -n1)
approve_showroom "$SHOWROOM_ID_3"

DEDUP_1="showroom:${SHOWROOM_ID_1}:approved"
DEDUP_3="showroom:${SHOWROOM_ID_3}:approved"

print_section "List notifications + newest first + pagination"
http_request "GET /users/me/notifications?limit=2" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/users/me/notifications?limit=2"

COUNT_PAGE_1=$(echo "$LAST_BODY" | jq -r '.data.items | length')
assert_eq "$COUNT_PAGE_1" "2" "page1 items length"
HAS_MORE=$(echo "$LAST_BODY" | jq -r '.data.meta.hasMore')
assert_eq "$HAS_MORE" "true" "page1 hasMore"
NEXT_CURSOR=$(echo "$LAST_BODY" | jq -r '.data.meta.nextCursor // empty')
assert_non_empty "$NEXT_CURSOR" "page1 nextCursor"

ITEM0_CREATED_AT=$(echo "$LAST_BODY" | jq -r '.data.items[0].createdAt')
ITEM1_CREATED_AT=$(echo "$LAST_BODY" | jq -r '.data.items[1].createdAt')
node -e "const a=Date.parse(process.argv[1]); const b=Date.parse(process.argv[2]); if (!Number.isFinite(a)||!Number.isFinite(b)||a<b) process.exit(1);" \
  "$ITEM0_CREATED_AT" "$ITEM1_CREATED_AT" || fail "Expected newest-first order by createdAt desc"

HAS_D3_PAGE1=$(echo "$LAST_BODY" | jq -r --arg id "$DEDUP_3" '.data.items[]?.dedupeKey | select(. == $id)')
assert_non_empty "$HAS_D3_PAGE1" "latest notification on first page"

CURSOR_ESC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$NEXT_CURSOR")
http_request "GET /users/me/notifications page2" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/users/me/notifications?limit=2&cursor=${CURSOR_ESC}"

HAS_D1_PAGE2=$(echo "$LAST_BODY" | jq -r --arg id "$DEDUP_1" '.data.items[]?.dedupeKey | select(. == $id)')
assert_non_empty "$HAS_D1_PAGE2" "older notification on second page"

print_section "Unread count and mark read"
http_request "GET /users/me/notifications/unread-count" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/users/me/notifications/unread-count"
UNREAD_BEFORE=$(echo "$LAST_BODY" | jq -r '.data.unreadCount')

http_request "PATCH /users/me/notifications/{id}/read" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" \
  "${BASE_URL}/users/me/notifications/${DEDUP_3}/read"
IS_READ=$(echo "$LAST_BODY" | jq -r '.data.isRead')
assert_eq "$IS_READ" "true" "isRead after patch"

http_request "PATCH /users/me/notifications/{id}/read idempotent" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" \
  "${BASE_URL}/users/me/notifications/${DEDUP_3}/read"
IS_READ_AGAIN=$(echo "$LAST_BODY" | jq -r '.data.isRead')
assert_eq "$IS_READ_AGAIN" "true" "isRead idempotent patch"

http_request "GET /users/me/notifications/unread-count after read" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/users/me/notifications/unread-count"
UNREAD_AFTER=$(echo "$LAST_BODY" | jq -r '.data.unreadCount')
EXPECTED_AFTER=$((UNREAD_BEFORE - 1))
assert_eq "$UNREAD_AFTER" "$EXPECTED_AFTER" "unreadCount after read"

print_section "Cross-user isolation"
http_request "PATCH /users/me/notifications/{owner-id}/read with admin token" 404 "NOTIFICATION_NOT_FOUND" \
  -X PATCH "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/users/me/notifications/${DEDUP_3}/read"

print_section "RESULT"
echo "✔ Notifications read/unread tests passed"
