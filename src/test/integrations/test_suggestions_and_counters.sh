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
AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
ADMIN_HEADER=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")
NOW=$(now_ns)
warn_if_prod_write "${BASE_URL}"
SHORT_NOW="${NOW: -6}"

create_and_approve_showroom() {
  local name=$1
  local city=$2
  local lat=$3
  local lng=$4
  local brand=$5
  local address="${city} Test St ${SHORT_NOW}"

  http_request "POST /showrooms/draft (${name})" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  local showroom_id
  showroom_id=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$showroom_id" "showroom id"

  http_request "PATCH /showrooms/{id} (${name})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${name}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"${address}\",\"city\":\"${city}\",\"availability\":\"open\",\"brands\":[\"${brand}\"],\"contacts\":{\"phone\":\"+380501112233\",\"instagram\":\"https://instagram.com/${SHORT_NOW}\"},\"location\":{\"lat\":${lat},\"lng\":${lng}}}" \
    "${BASE_URL}/showrooms/${showroom_id}"

  http_request "PATCH /showrooms/{id} (geo ${name})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"geo\":{\"city\":\"${city}\",\"country\":\"Ukraine\",\"coords\":{\"lat\":${lat},\"lng\":${lng}},\"placeId\":\"test-place-${SHORT_NOW}\"}}" \
    "${BASE_URL}/showrooms/${showroom_id}"

  http_request "POST /showrooms/{id}/submit (${name})" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/${showroom_id}/submit"

  http_request "POST /admin/showrooms/{id}/approve (${name})" 200 "" \
    -X POST "${ADMIN_HEADER[@]}" \
    "${BASE_URL}/admin/showrooms/${showroom_id}/approve"

  http_request "GET /showrooms/{id} (${name})" 200 "" \
    "${AUTH_HEADER[@]}" \
    "${BASE_URL}/showrooms/${showroom_id}"

  local status
  status=$(json_get "$LAST_BODY" '.data.showroom.status // empty')
  assert_eq "$status" "approved" "status"

  local geohash
  geohash=$(json_get "$LAST_BODY" '.data.showroom.geo.geohash // empty')
  assert_non_empty "$geohash" "geohash"

  echo "${showroom_id}|${geohash}"
}

print_section "Seed showrooms"
NAME_TOTAL="Total White ${SHORT_NOW}"
NAME_COAT="The Coat ${SHORT_NOW}"
NAME_ROAR="Roar ${SHORT_NOW}"
BRAND_TEST="BrandTest${SHORT_NOW}"

# create_and_approve_showroom logs multiple lines; keep only the final "id|geohash" row.
INFO_TOTAL=$(create_and_approve_showroom "$NAME_TOTAL" "Kyiv" 50.4501 30.5234 "$BRAND_TEST" | tail -n1)
create_and_approve_showroom "$NAME_COAT" "Kyiv" 50.4502 30.5235 "$BRAND_TEST" >/dev/null
INFO_ROAR=$(create_and_approve_showroom "$NAME_ROAR" "Lviv" 49.8397 24.0297 "$BRAND_TEST" | tail -n1)

GEOHASH_A=$(printf '%s' "$INFO_TOTAL" | cut -d'|' -f2)
GEOHASH_B=$(printf '%s' "$INFO_ROAR" | cut -d'|' -f2)

PREFIX_A="${GEOHASH_A:0:4}"
PREFIX_B="${GEOHASH_B:0:4}"
# sanitize prefixes to avoid malformed URLs in curl.
PREFIX_A=$(echo "$PREFIX_A" | tr -cd '[:alnum:]')
PREFIX_B=$(echo "$PREFIX_B" | tr -cd '[:alnum:]')
assert_non_empty "$PREFIX_A" "prefix A"
assert_non_empty "$PREFIX_B" "prefix B"

print_section "Suggestions by showroom name"
http_request "GET /showrooms/suggestions?q=to" 200 "" \
  "${BASE_URL}/showrooms/suggestions?q=to"

FOUND_NAME=$(echo "$LAST_BODY" | jq -r '.data.suggestions[] | select(.type=="showroom") | select(.value|test("^Total White")) | .value' | head -n1)
assert_non_empty "$FOUND_NAME" "showroom suggestion Total White"

print_section "Suggestions by city"
http_request "GET /showrooms/suggestions?q=ky&qMode=city" 200 "" \
  "${BASE_URL}/showrooms/suggestions?q=ky&qMode=city"

FOUND_CITY=$(echo "$LAST_BODY" | jq -r '.data.suggestions[] | select(.type=="city") | select(.value=="Kyiv") | .value' | head -n1)
assert_non_empty "$FOUND_CITY" "city suggestion Kyiv"

print_section "Suggestions city precedence"
http_request "GET /showrooms/suggestions?city=Kyiv&qMode=city&q=lv" 200 "" \
  "${BASE_URL}/showrooms/suggestions?city=Kyiv&qMode=city&q=lv"

FOUND_LVIV=$(echo "$LAST_BODY" | jq -r '.data.suggestions[] | select(.type=="city") | select(.value=="Lviv") | .value' | head -n1)
if [[ -n "$FOUND_LVIV" ]]; then
  fail "city precedence failed (Lviv suggested)"
fi

print_section "Counters by city"
http_request "GET /showrooms/counters?city=Kyiv&brand=BrandTest" 200 "" \
  "${BASE_URL}/showrooms/counters?city=Kyiv&brand=${BRAND_TEST}"

TOTAL_CITY=$(json_get "$LAST_BODY" '.data.total // 0')
assert_eq "$TOTAL_CITY" "2" "Kyiv total"

print_section "Counters blocked country (public/admin/owner)"
http_request "GET /showrooms/counters?country=Russia (public)" 200 "" \
  "${BASE_URL}/showrooms/counters?country=Russia"
BLOCKED_TOTAL_PUBLIC=$(json_get "$LAST_BODY" '.data.total // 0')
assert_eq "$BLOCKED_TOTAL_PUBLIC" "0" "blocked country total (public)"

http_request "GET /showrooms/counters?country=Russia (owner)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/counters?country=Russia"
BLOCKED_TOTAL_OWNER=$(json_get "$LAST_BODY" '.data.total // 0')
assert_eq "$BLOCKED_TOTAL_OWNER" "0" "blocked country total (owner)"

http_request "GET /showrooms/counters?country=Russia (admin)" 200 "" \
  "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/showrooms/counters?country=Russia"
BLOCKED_TOTAL_ADMIN=$(json_get "$LAST_BODY" '.data.total // 0')
assert_eq "$BLOCKED_TOTAL_ADMIN" "0" "blocked country total (admin)"

print_section "Counters by multi-prefix"
echo
echo "▶ GET /showrooms/counters (multi-prefix)"
RESPONSE=$(curl -sS -G -w "\nHTTP_STATUS:%{http_code}" \
  --data "geohashPrefixes=${PREFIX_A}" \
  --data "geohashPrefixes=${PREFIX_B}" \
  --data "brand=${BRAND_TEST}" \
  "${BASE_URL}/showrooms/counters") || fail "curl failed"
LAST_STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
LAST_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "$LAST_BODY"
if [[ "$LAST_STATUS" == "500" ]]; then
  fail "Expected INDEX_NOT_READY or 200, got HTTP 500"
fi
if [[ "$LAST_STATUS" == "503" ]]; then
  CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
  assert_eq "$CODE" "INDEX_NOT_READY" "error.code"
  echo "⚠ INDEX_NOT_READY for multi-prefix counters (expected when index is missing)"
elif [[ "$LAST_STATUS" == "200" ]]; then
  TOTAL_PREFIX=$(json_get "$LAST_BODY" '.data.total // 0')
  assert_eq "$TOTAL_PREFIX" "3" "multi-prefix total"
else
  fail "Expected HTTP 200 or 503, got $LAST_STATUS"
fi
echo "✔ HTTP $LAST_STATUS"

print_section "Negative: suggestions empty q"
http_request "GET /showrooms/suggestions?q=" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms/suggestions?q="

print_section "Negative: q + geohashPrefix invalid"
http_request "GET /showrooms/suggestions?q=to&geohashPrefix=A" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms/suggestions?q=to&geohashPrefix=${PREFIX_A}"

http_request "GET /showrooms/counters?q=to&geohashPrefix=A" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms/counters?q=to&geohashPrefix=${PREFIX_A}"

print_section "Negative: invalid filter combo (suggestions)"
http_request "GET /showrooms/suggestions invalid combo" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms/suggestions?q=to&categories=womenswear&categoryGroup=clothing"

print_section "Negative: invalid filter combo (counters)"
http_request "GET /showrooms/counters invalid combo" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms/counters?categoryGroup=clothing&subcategories=dresses"

print_section "Negative: counters overlapping prefixes"
OVERLAP_SHORT="${GEOHASH_A:0:4}"
OVERLAP_LONG="${GEOHASH_A:0:5}"
OVERLAP_SHORT=$(echo "$OVERLAP_SHORT" | tr -cd '[:alnum:]')
OVERLAP_LONG=$(echo "$OVERLAP_LONG" | tr -cd '[:alnum:]')
assert_non_empty "$OVERLAP_SHORT" "overlap short prefix"
assert_non_empty "$OVERLAP_LONG" "overlap long prefix"
http_request "GET /showrooms/counters overlap" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms/counters?geohashPrefixes=${OVERLAP_SHORT},${OVERLAP_LONG}"

print_section "q minLen"
http_request "GET /showrooms/suggestions?q=t" 200 "" \
  "${BASE_URL}/showrooms/suggestions?q=t"

EMPTY_SUGGESTIONS=$(echo "$LAST_BODY" | jq -r '.data.suggestions | length')
assert_eq "$EMPTY_SUGGESTIONS" "0" "q minLen empty suggestions"

print_section "RESULT"
echo "✔ Suggestions + counters tests passed"
