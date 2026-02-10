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
TEST_USER_TOKEN="${TEST_USER_TOKEN//$'\r'/}"
TEST_ADMIN_TOKEN="${TEST_ADMIN_TOKEN//$'\r'/}"
AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
ADMIN_HEADER=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")

guard_prod_write "${BASE_URL}"

seed_geo_showroom() {
  local lat=$1
  local lng=$2
  local suffix=$3
  local ts
  ts=$(date +%s)

  local body
  body=$(jq -n \
    --arg country "Ukraine" \
    --arg city "Kyiv" \
    --arg placeId "test-seed-${suffix}-${ts}" \
    --arg name "Geo Seed ${suffix} ${ts}" \
    --arg type "multibrand" \
    --arg availability "open" \
    --arg address "Kyiv, Khreshchatyk ${suffix} ${ts}" \
    --arg phone "+380999111223" \
    --arg instagram "https://instagram.com/geo-seed-${suffix}-${ts}" \
    --argjson lat "$lat" \
    --argjson lng "$lng" \
    '{
      country:$country,
      name:$name,
      type:$type,
      availability:$availability,
      address:$address,
      city:$city,
      contacts:{phone:$phone, instagram:$instagram},
      location:{lat:$lat, lng:$lng},
      geo:{city:$city, country:$country, coords:{lat:$lat, lng:$lng}, placeId:$placeId}
    }')

  local created
  created=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "$body" "${BASE_URL}/showrooms/create")
  local create_status
  create_status=$(echo "$created" | sed -n 's/.*HTTP_STATUS://p')
  local create_body
  create_body=$(echo "$created" | sed '/HTTP_STATUS/d')
  if [[ "$create_status" != "200" ]]; then
    echo "$create_body"
    fail "seed showroom create failed (HTTP ${create_status})"
  fi
  local id
  id=$(echo "$create_body" | jq -r '.data.showroom.id // empty')
  if [[ -z "$id" || "$id" == "null" ]]; then
    echo "$create_body"
    fail "seed showroom id is empty"
  fi

  local geo_hash
  geo_hash=$(echo "$create_body" | jq -r '.data.showroom.geo.geohash // empty')
  assert_non_empty "$geo_hash" "seed showroom geo.geohash"

  echo "${id}:${geo_hash}"
}

approve_showroom() {
  local id=$1

  local submit
  submit=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${AUTH_HEADER[@]}" \
    "${BASE_URL}/showrooms/${id}/submit")
  local submit_status
  submit_status=$(echo "$submit" | sed -n 's/.*HTTP_STATUS://p')
  local submit_body
  submit_body=$(echo "$submit" | sed '/HTTP_STATUS/d')
  echo "$submit_body"
  assert_eq "$submit_status" "200" "submit showroom"

  local approve
  approve=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${ADMIN_HEADER[@]}" \
    "${BASE_URL}/admin/showrooms/${id}/approve")
  local approve_status
  approve_status=$(echo "$approve" | sed -n 's/.*HTTP_STATUS://p')
  local approve_body
  approve_body=$(echo "$approve" | sed '/HTTP_STATUS/d')
  echo "$approve_body"
  assert_eq "$approve_status" "200" "approve showroom"
}

print_section "Seed geo showrooms"
SEED1=$(seed_geo_showroom "50.4501" "30.5234" "1")
SEED2=$(seed_geo_showroom "50.4502" "30.5235" "2")
SEED3=$(seed_geo_showroom "50.4503" "30.5236" "3")

IFS=: read -r SEED_ID1 SEED_GEO1 <<<"$SEED1"
IFS=: read -r SEED_ID2 _ <<<"$SEED2"
IFS=: read -r SEED_ID3 _ <<<"$SEED3"

assert_non_empty "$SEED_ID1" "seed id 1"
assert_non_empty "$SEED_ID2" "seed id 2"
assert_non_empty "$SEED_ID3" "seed id 3"
assert_non_empty "$SEED_GEO1" "seed geohash 1"

PREFIX="${SEED_GEO1:0:5}"
assert_non_empty "$PREFIX" "seed geohash prefix"
echo "PREFIX=${PREFIX}"

print_section "Submit + approve seeded showrooms"
approve_showroom "$SEED_ID1"
approve_showroom "$SEED_ID2"
approve_showroom "$SEED_ID3"

print_section "Default list"
DEFAULT_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms?limit=5")
echo "$DEFAULT_JSON"

print_section "Default cursor (for cross-mode check)"
DEFAULT_CURSOR_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms?limit=1")
echo "$DEFAULT_CURSOR_JSON"
DEFAULT_CURSOR=$(echo "$DEFAULT_CURSOR_JSON" | jq -r '.meta.nextCursor // empty')

print_section "Map single prefix paging"
MAP1_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms?geohashPrefix=${PREFIX}&limit=1")
echo "$MAP1_JSON"
MAP_CURSOR=$(echo "$MAP1_JSON" | jq -r '.meta.nextCursor // empty')
MAP_HAS_MORE=$(echo "$MAP1_JSON" | jq -r '.meta.hasMore')
assert_non_empty "$MAP_CURSOR" "map nextCursor"
assert_eq "$MAP_HAS_MORE" "true" "map hasMore"
MAP_IDS1=$(echo "$MAP1_JSON" | jq -r '.data.showrooms[]?.id')
assert_non_empty "$MAP_IDS1" "map page 1 ids"

MAP2_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms?geohashPrefix=${PREFIX}&limit=1&cursor=${MAP_CURSOR}")
echo "$MAP2_JSON"
MAP_IDS2=$(echo "$MAP2_JSON" | jq -r '.data.showrooms[]?.id')
assert_non_empty "$MAP_IDS2" "map page 2 ids"
MAP2_PAGING=$(echo "$MAP2_JSON" | jq -r '.meta.paging // empty')
MAP2_HAS_MORE=$(echo "$MAP2_JSON" | jq -r '.meta.hasMore')
if [[ "$MAP2_PAGING" != "enabled" && "$MAP2_PAGING" != "end" ]]; then
  fail "Expected map page 2 paging=enabled|end, got $MAP2_PAGING"
fi
if [[ "$MAP2_HAS_MORE" != "true" && "$MAP2_HAS_MORE" != "false" ]]; then
  fail "Expected map page 2 hasMore boolean, got $MAP2_HAS_MORE"
fi

if [[ -n "$MAP_IDS1" && -n "$MAP_IDS2" ]]; then
  for id in $MAP_IDS1; do
    if echo "$MAP_IDS2" | grep -qx "$id"; then
      fail "Duplicate ids across map pages"
    fi
  done
fi

print_section "Map multi-prefix"
MULTI_PREFIXES="${PREFIX},u4"
if [[ -z "$PREFIX" ]]; then
  MULTI_PREFIXES="u4,u5"
fi
MULTI_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms?geohashPrefixes=${MULTI_PREFIXES}")
echo "$MULTI_JSON"
PAGING=$(echo "$MULTI_JSON" | jq -r '.meta.paging // empty')
REASON=$(echo "$MULTI_JSON" | jq -r '.meta.reason // empty')
NEXT_CURSOR=$(echo "$MULTI_JSON" | jq -r '.meta.nextCursor')
assert_eq "$PAGING" "disabled" "meta.paging"
assert_eq "$REASON" "multi_geohash_prefixes" "meta.reason"
assert_eq "$NEXT_CURSOR" "null" "meta.nextCursor"

print_section "Empty state (city)"
EMPTY_JSON=$(curl -s "${BASE_URL}/showrooms?city=NonexistentCity")
echo "$EMPTY_JSON"
COUNT=$(echo "$EMPTY_JSON" | jq -r '.data.showrooms | length')
PAGING=$(echo "$EMPTY_JSON" | jq -r '.meta.paging // empty')
HAS_MORE=$(echo "$EMPTY_JSON" | jq -r '.meta.hasMore')
assert_eq "$COUNT" "0" "empty results count"
assert_eq "$PAGING" "end" "meta.paging"
assert_eq "$HAS_MORE" "false" "meta.hasMore"

print_section "Cursor misuse: map + q"
MAPQ=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/showrooms?geohashPrefix=u9yx8&q=test")
MAPQ_STATUS=$(echo "$MAPQ" | sed -n 's/.*HTTP_STATUS://p')
MAPQ_BODY=$(echo "$MAPQ" | sed '/HTTP_STATUS/d')
echo "$MAPQ_BODY"
assert_eq "$MAPQ_STATUS" "400" "HTTP status"
CODE=$(echo "$MAPQ_BODY" | jq -r '.error.code // empty')
assert_eq "$CODE" "QUERY_INVALID" "error.code"

assert_non_empty "$DEFAULT_CURSOR" "default nextCursor"
print_section "Cursor misuse: cross-mode"
CROSS=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/showrooms?geohashPrefix=${PREFIX}&cursor=${DEFAULT_CURSOR}")
CROSS_STATUS=$(echo "$CROSS" | sed -n 's/.*HTTP_STATUS://p')
CROSS_BODY=$(echo "$CROSS" | sed '/HTTP_STATUS/d')
echo "$CROSS_BODY"
assert_eq "$CROSS_STATUS" "400" "HTTP status"
CODE=$(echo "$CROSS_BODY" | jq -r '.error.code // empty')
assert_eq "$CODE" "CURSOR_INVALID" "error.code"

print_section "Legacy geo"
LEGACY_TS=$(date +%s)
DRAFT_JSON=$(curl -s -X POST "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms/draft")
echo "$DRAFT_JSON"
SHOWROOM_ID=$(echo "$DRAFT_JSON" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_ID" "showroom id"

PATCH_NO_GEO=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Legacy Geo Test ${LEGACY_TS}\"}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}")
PATCH_NO_GEO_STATUS=$(echo "$PATCH_NO_GEO" | sed -n 's/.*HTTP_STATUS://p')
PATCH_NO_GEO_BODY=$(echo "$PATCH_NO_GEO" | sed '/HTTP_STATUS/d')
echo "$PATCH_NO_GEO_BODY"
assert_eq "$PATCH_NO_GEO_STATUS" "200" "PATCH without geo"

PATCH_PARTIAL=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"geo":{"city":"Kyiv"}}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}")
PATCH_PARTIAL_STATUS=$(echo "$PATCH_PARTIAL" | sed -n 's/.*HTTP_STATUS://p')
PATCH_PARTIAL_BODY=$(echo "$PATCH_PARTIAL" | sed '/HTTP_STATUS/d')
echo "$PATCH_PARTIAL_BODY"
assert_eq "$PATCH_PARTIAL_STATUS" "400" "PATCH partial geo"

print_section "RESULT"
echo "✔ Geo paging checks passed"

print_section "Cleanup"
CLEANUP_SUPPORTED=0
if [[ "$CLEANUP_SUPPORTED" -eq 1 ]]; then
  for id in "$SEED_ID1" "$SEED_ID2" "$SEED_ID3"; do
    curl -s -X POST "${ADMIN_HEADER[@]}" "${BASE_URL}/admin/showrooms/${id}/reject" >/dev/null || true
  done
else
  echo "cleanup skipped: no delete/soft-delete endpoint"
fi
