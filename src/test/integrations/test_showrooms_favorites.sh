#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_lib.sh"

load_env
require_cmd curl jq
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
  if [[ "$user_role" == "admin" ]]; then
    fail "TEST_USER_TOKEN must be user/owner for this suite (admin token detected)"
  fi
  if [[ "$user_role" == "owner" ]]; then
    return
  fi

  http_request "POST /users/complete-owner-profile (upgrade for favorites test)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Owner ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner${NOW}\"}" \
    "${BASE_URL}/users/complete-owner-profile"
}

create_submittable_showroom() {
  local suffix=$1
  local city=$2
  local draft_id
  local unique="${SHORT_NOW}${suffix}"
  local lat="49.4444"
  local lng="32.0598"

  if [[ "$city" == "Kyiv" ]]; then
    lat="50.4501"
    lng="30.5234"
  fi

  http_request "POST /showrooms/draft (${suffix})" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  draft_id=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$draft_id" "draft showroom id (${suffix})"

  http_request "PATCH /showrooms/{id} (${suffix})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Favorites ${unique}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"${city}, Favorites St ${unique}\",\"city\":\"${city}\",\"availability\":\"open\",\"category\":\"womenswear\",\"categoryGroup\":\"clothing\",\"subcategories\":[\"dresses\"],\"brands\":[\"BrandTest${SHORT_NOW}\"],\"contacts\":{\"phone\":\"+380501112233\",\"instagram\":\"https://instagram.com/fav${SHORT_NOW}${suffix}\"},\"location\":{\"lat\":${lat},\"lng\":${lng}}}" \
    "${BASE_URL}/showrooms/${draft_id}"

  http_request "PATCH /showrooms/{id} geo (${suffix})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"geo\":{\"city\":\"${city}\",\"country\":\"Ukraine\",\"coords\":{\"lat\":${lat},\"lng\":${lng}},\"placeId\":\"test-place-fav-${unique}\"}}" \
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

reject_showroom() {
  local showroom_id=$1
  http_request "POST /admin/showrooms/{id}/reject (${showroom_id})" 200 "" \
    -X POST "${ADMIN_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"reason":"favorites test reject"}' \
    "${BASE_URL}/admin/showrooms/${showroom_id}/reject"
}

print_section "Setup owner role"
ensure_owner_role

print_section "Create approved showroom for happy-path"
APPROVED_ID=$(create_submittable_showroom "approved" "Kyiv" | tail -n1)
approve_showroom "$APPROVED_ID"

print_section "Favorite add/remove idempotent"
http_request "POST /showrooms/{id}/favorite" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"

http_request "POST /showrooms/{id}/favorite idempotent" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"

print_section "Collections list contains favorite"
http_request "GET /collections/favorites/showrooms (auth)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/favorites/showrooms?limit=20"

HAS_APPROVED=$(echo "$LAST_BODY" | jq -r --arg id "$APPROVED_ID" '.data.items[]?.id | select(. == $id)')
assert_non_empty "$HAS_APPROVED" "approved showroom in favorites collection"

http_request "DELETE /showrooms/{id}/favorite" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"

http_request "DELETE /showrooms/{id}/favorite idempotent" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"

http_request "GET /collections/favorites/showrooms after remove" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/favorites/showrooms?limit=20"

HAS_APPROVED_AFTER_REMOVE=$(echo "$LAST_BODY" | jq -r --arg id "$APPROVED_ID" '.data.items[]?.id | select(. == $id)')
if [[ -n "$HAS_APPROVED_AFTER_REMOVE" ]]; then
  fail "Removed showroom must not appear in favorites collection"
fi

print_section "Non-approved states return 404"
http_request "POST /showrooms/draft (draft target)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"
DRAFT_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
assert_non_empty "$DRAFT_ID" "draft id"

PENDING_ID=$(create_submittable_showroom "pending" "Lviv" | tail -n1)
REJECTED_ID=$(create_submittable_showroom "rejected" "Cherkasy" | tail -n1)
reject_showroom "$REJECTED_ID"
DELETED_ID=$(create_submittable_showroom "deleted" "Zaporizhzhia" | tail -n1)
approve_showroom "$DELETED_ID"
http_request "DELETE /showrooms/{id} (deleted target)" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${DELETED_ID}"

http_request "POST /showrooms/{draft}/favorite" 404 "SHOWROOM_NOT_FOUND" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${DRAFT_ID}/favorite"

http_request "POST /showrooms/{pending}/favorite" 404 "SHOWROOM_NOT_FOUND" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${PENDING_ID}/favorite"

http_request "POST /showrooms/{rejected}/favorite" 404 "SHOWROOM_NOT_FOUND" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${REJECTED_ID}/favorite"

http_request "POST /showrooms/{deleted}/favorite" 404 "SHOWROOM_NOT_FOUND" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${DELETED_ID}/favorite"

http_request "POST /showrooms/{missing}/favorite" 404 "SHOWROOM_NOT_FOUND" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/showroom_missing_${NOW}/favorite"

print_section "Guest sync -> user favorites (showrooms)"
SYNC_MISSING_ID="showroom_missing_sync_${NOW}"
SYNC_PAYLOAD=$(jq -nc --arg approved "$APPROVED_ID" --arg draft "$DRAFT_ID" --arg missing "$SYNC_MISSING_ID" \
  '{favoriteIds: [$approved, $draft, $missing]}')
http_request "POST /collections/favorites/showrooms/sync" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$SYNC_PAYLOAD" \
  "${BASE_URL}/collections/favorites/showrooms/sync"

SYNC_APPLIED=$(echo "$LAST_BODY" | jq -r --arg id "$APPROVED_ID" '.data.applied.favorites[]? | select(. == $id)')
SYNC_SKIPPED_DRAFT=$(echo "$LAST_BODY" | jq -r --arg id "$DRAFT_ID" '.data.skipped[]? | select(. == $id)')
SYNC_SKIPPED_MISSING=$(echo "$LAST_BODY" | jq -r --arg id "$SYNC_MISSING_ID" '.data.skipped[]? | select(. == $id)')
assert_non_empty "$SYNC_APPLIED" "sync applied approved showroom"
assert_non_empty "$SYNC_SKIPPED_DRAFT" "sync skipped draft showroom"
assert_non_empty "$SYNC_SKIPPED_MISSING" "sync skipped missing showroom"

http_request "GET /collections/favorites/showrooms after sync" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/favorites/showrooms?limit=20"
SYNC_LIST_HAS_APPROVED=$(echo "$LAST_BODY" | jq -r --arg id "$APPROVED_ID" '.data.items[]?.id | select(. == $id)')
assert_non_empty "$SYNC_LIST_HAS_APPROVED" "approved showroom after sync"

http_request "DELETE /showrooms/{id}/favorite after sync" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"

TOO_MANY_IDS=$(jq -nc '[range(0;101) | "showroom_bulk_\(.)"]')
TOO_MANY_PAYLOAD=$(jq -nc --argjson ids "$TOO_MANY_IDS" '{favoriteIds: $ids}')
http_request "POST /collections/favorites/showrooms/sync (>100)" 400 "SHOWROOM_SYNC_LIMIT_EXCEEDED" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$TOO_MANY_PAYLOAD" \
  "${BASE_URL}/collections/favorites/showrooms/sync"

print_section "Guest collections compatibility"
http_request "GET /collections/favorites/showrooms (guest)" 200 "" \
  "${BASE_URL}/collections/favorites/showrooms?limit=20"

GUEST_COUNT=$(echo "$LAST_BODY" | jq -r '.data.items | length')
assert_eq "$GUEST_COUNT" "0" "guest favorites count"
GUEST_HAS_MORE=$(echo "$LAST_BODY" | jq -r '.meta.hasMore')
assert_eq "$GUEST_HAS_MORE" "false" "guest hasMore"

print_section "RESULT"
echo "✔ Showrooms favorites tests passed"
