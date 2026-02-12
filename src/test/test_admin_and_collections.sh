#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq
require_env TEST_USER_TOKEN TEST_ADMIN_TOKEN

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
guard_prod_write "${BASE_URL}"
AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
ADMIN_HEADER=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")
NOW=$(now_ns)
warn_if_prod_write "${BASE_URL}"
SHORT_NOW="${NOW: -6}"
SAFE_SUFFIX=$(printf '%s' "$SHORT_NOW" | tr '0-9' 'a-j')

print_section "Collections stubs (public)"
http_request "GET /collections/favorites/showrooms" 200 "" \
  "${BASE_URL}/collections/favorites/showrooms"
http_request "GET /collections/favorites/lookbooks (auth required)" 401 "AUTH_MISSING" \
  "${BASE_URL}/collections/favorites/lookbooks"
http_request "GET /collections/favorites/lookbooks (auth)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/favorites/lookbooks"
http_request "GET /collections/want-to-visit/events (auth required)" 401 "AUTH_MISSING" \
  "${BASE_URL}/collections/want-to-visit/events"
http_request "GET /collections/want-to-visit/events (auth)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/want-to-visit/events"

print_section "Cursor validation (public)"
http_request "GET /showrooms?cursor=bad (invalid)" 400 "CURSOR_INVALID" \
  "${BASE_URL}/showrooms?cursor=bad"

print_section "Admin review flow"
http_request "POST /showrooms/draft" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_ID" "showroom id"

print_section "Admin cannot approve/reject when not pending"
http_request "POST /admin/showrooms/{id}/approve (draft)" 400 "SHOWROOM_NOT_EDITABLE" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/approve"

http_request "POST /admin/showrooms/{id}/reject (draft)" 400 "SHOWROOM_NOT_EDITABLE" \
  -X POST "${ADMIN_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"reason":"Invalid state"}' \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/reject"

NAME_MAIN="Admin Review ${SAFE_SUFFIX}"
http_request "PATCH /showrooms/{id} (complete data)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_MAIN}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"Cherkasy, Main St 2\",\"city\":\"Cherkasy\",\"availability\":\"open\",\"contacts\":{\"phone\":\"+380501112244\",\"instagram\":\"https://instagram.com/review${SHORT_NOW}\"},\"location\":{\"lat\":49.4444,\"lng\":32.0598}}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

http_request "POST /showrooms/{id}/submit" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}/submit"

PENDING_SNAPSHOT=$(echo "$LAST_BODY" | jq -c '.data.showroom.pendingSnapshot // empty')
if [[ -z "$PENDING_SNAPSHOT" || "$PENDING_SNAPSHOT" == "null" ]]; then
  fail "pendingSnapshot missing after submit"
fi
SNAPSHOT_HASH=$(echo "$PENDING_SNAPSHOT" | shasum -a 256 | awk '{print $1}')

print_section "Pending lock + snapshot immutability"
http_request "PATCH pending (locked)" 409 "SHOWROOM_LOCKED_PENDING" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Should Fail"}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

http_request "GET /showrooms/{id} (snapshot unchanged)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

SNAPSHOT_HASH_AFTER=$(echo "$LAST_BODY" | jq -c '.data.showroom.pendingSnapshot // empty' | shasum -a 256 | awk '{print $1}')
assert_eq "$SNAPSHOT_HASH_AFTER" "$SNAPSHOT_HASH" "pendingSnapshot hash"

http_request "GET /showrooms/{id} (after submit)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

LAST_ACTION=$(json_get "$LAST_BODY" '.data.showroom.editHistory[-1].action // empty')
LAST_STATUS_BEFORE=$(json_get "$LAST_BODY" '.data.showroom.editHistory[-1].statusBefore // empty')
LAST_STATUS_AFTER=$(json_get "$LAST_BODY" '.data.showroom.editHistory[-1].statusAfter // empty')
CHANGED_HAS_STATUS=$(json_get "$LAST_BODY" '.data.showroom.editHistory[-1].changedFields | index("status")')

assert_eq "$LAST_ACTION" "submit" "last action"
assert_eq "$LAST_STATUS_BEFORE" "draft" "statusBefore"
assert_eq "$LAST_STATUS_AFTER" "pending" "statusAfter"
if [[ "$CHANGED_HAS_STATUS" == "null" ]]; then
  fail "editHistory.changedFields missing status"
fi

print_section "Admin reject"
http_request "POST /admin/showrooms/{id}/reject" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"reason":"Missing details"}' \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/reject"

STATUS=$(json_get "$LAST_BODY" '.data.showroom.status // empty')
assert_eq "$STATUS" "rejected" "status"
PENDING_SNAPSHOT=$(json_get "$LAST_BODY" '.data.showroom.pendingSnapshot // empty')
if [[ "$PENDING_SNAPSHOT" != "null" && -n "$PENDING_SNAPSHOT" ]]; then
  fail "pendingSnapshot should be cleared on reject"
fi

print_section "Owner resubmit -> admin approve"
UPDATED_NAME="Admin Review Updated ${SAFE_SUFFIX}"
http_request "PATCH rejected (update name)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${UPDATED_NAME}\"}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

http_request "POST /showrooms/{id}/submit (again)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}/submit"

http_request "POST /admin/showrooms/{id}/approve" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/approve"

STATUS=$(json_get "$LAST_BODY" '.data.showroom.status // empty')
assert_eq "$STATUS" "approved" "status"
PENDING_SNAPSHOT=$(json_get "$LAST_BODY" '.data.showroom.pendingSnapshot // empty')
if [[ "$PENDING_SNAPSHOT" != "null" && -n "$PENDING_SNAPSHOT" ]]; then
  fail "pendingSnapshot should be cleared on approve"
fi

NAME_CURRENT=$(json_get "$LAST_BODY" '.data.showroom.name // empty')
assert_eq "$NAME_CURRENT" "$UPDATED_NAME" "approved name"

LAST_ACTION=$(json_get "$LAST_BODY" '.data.showroom.editHistory[-1].action // empty')
LAST_STATUS_BEFORE=$(json_get "$LAST_BODY" '.data.showroom.editHistory[-1].statusBefore // empty')
LAST_STATUS_AFTER=$(json_get "$LAST_BODY" '.data.showroom.editHistory[-1].statusAfter // empty')

assert_eq "$LAST_ACTION" "approve" "last action"
assert_eq "$LAST_STATUS_BEFORE" "pending" "statusBefore"
assert_eq "$LAST_STATUS_AFTER" "approved" "statusAfter"

print_section "Owner delete approved"
http_request "DELETE approved (owner)" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

STATUS=$(json_get "$LAST_BODY" '.data.showroom.status // empty')
assert_eq "$STATUS" "deleted" "status"

print_section "Deleted hidden from public list"
LIST=$(curl -s "${BASE_URL}/showrooms")
FOUND=$(echo "$LIST" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[]?.id | select(. == $id)')
if [[ -n "$FOUND" ]]; then
  fail "Deleted showroom appears in public list"
fi

print_section "Admin delete any status"
http_request "POST /showrooms/draft (admin delete target)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

ADMIN_DEL_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
assert_non_empty "$ADMIN_DEL_ID" "admin delete showroom id"

http_request "PATCH /showrooms/{id} (admin delete target)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Admin Delete ${SAFE_SUFFIX}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"Zaporizhzhia, Main St 3\",\"city\":\"Zaporizhzhia\",\"availability\":\"open\",\"contacts\":{\"phone\":\"+380501112255\",\"instagram\":\"https://instagram.com/admindelete${NOW}\"},\"location\":{\"lat\":47.8388,\"lng\":35.1396}}" \
  "${BASE_URL}/showrooms/${ADMIN_DEL_ID}"

http_request "POST /showrooms/{id}/submit (admin delete target)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${ADMIN_DEL_ID}/submit"

http_request "DELETE /admin/showrooms/{id} (pending)" 200 "" \
  -X DELETE "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/admin/showrooms/${ADMIN_DEL_ID}"

ADMIN_DEL_STATUS=$(json_get "$LAST_BODY" '.data.showroom.status // empty')
assert_eq "$ADMIN_DEL_STATUS" "deleted" "admin deleted status"

print_section "RESULT"
echo "✔ Admin + collections tests passed"
