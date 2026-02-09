#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq
require_env TEST_USER_TOKEN

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")
NOW=$(now_ns)
warn_if_prod_write "${BASE_URL}"

print_section "Auth + role"
ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
echo "$ME_RESPONSE"
USER_ROLE=$(json_get "$ME_RESPONSE" '.data.role // empty')
assert_non_empty "$USER_ROLE" "role"

if [[ "$USER_ROLE" != "owner" ]]; then
  http_request "POST /users/complete-owner-profile (upgrade)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Owner ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner${NOW}\"}" \
    "${BASE_URL}/users/complete-owner-profile"

  ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  USER_ROLE=$(json_get "$ME_RESPONSE" '.data.role // empty')
  assert_eq "$USER_ROLE" "owner" "role"
fi

print_section "Profile update"
http_request "PATCH /users/profile (settings)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"appLanguage":"uk","notificationsEnabled":true}' \
  "${BASE_URL}/users/profile"

http_request "PATCH /users/profile (name)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Profile Name ${NOW}\"}" \
  "${BASE_URL}/users/profile"

print_section "Draft flow"
NAME_MAIN="My Showroom 01 ${NOW}"
ADDRESS_MAIN="Cherkasy, Shevchenka Ave ${NOW}"

http_request "POST /showrooms/draft" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
STATUS=$(json_get "$LAST_BODY" '.data.showroom.status // empty')
assert_non_empty "$SHOWROOM_ID" "showroom id"
assert_eq "$STATUS" "draft" "status"

http_request "GET /showrooms/{id}" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

EDIT_COUNT=$(json_get "$LAST_BODY" '.data.showroom.editCount // 0')

http_request "PATCH step1 (name/type)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_MAIN}\",\"type\":\"multibrand\"}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "GET after step1" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

NEW_EDIT_COUNT=$(json_get "$LAST_BODY" '.data.showroom.editCount // 0')
assert_gt "$NEW_EDIT_COUNT" "$EDIT_COUNT" "editCount"
EDIT_COUNT=$NEW_EDIT_COUNT

CURRENT_AVAILABILITY=$(json_get "$LAST_BODY" '.data.showroom.availability // empty')
if [[ "$CURRENT_AVAILABILITY" == "open" ]]; then
  AVAILABILITY_NEXT="appointment"
else
  AVAILABILITY_NEXT="open"
fi

http_request "PATCH step2 (country/availability)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"country\":\"Ukraine\",\"availability\":\"${AVAILABILITY_NEXT}\",\"category\":\"womenswear\",\"brands\":[\"Brand A\",\"Brand B\"]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "PATCH step3 (address/city/location)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"address\":\"${ADDRESS_MAIN}\",\"city\":\"Cherkasy\",\"location\":{\"lat\":49.4444,\"lng\":32.0598}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

print_section "Geo model"
GEO_CITY_1="Cherkasy"
GEO_CITY_2="Zaporizhzhia"

http_request "PATCH geo (initial)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"geo\":{\"city\":\"${GEO_CITY_1}\",\"country\":\"Ukraine\",\"coords\":{\"lat\":49.4444,\"lng\":32.0598},\"placeId\":\"test-place-${NOW}\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "GET after geo (initial)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.city')" "$GEO_CITY_1" "geo.city"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.cityNormalized')" "cherkasy" "geo.cityNormalized"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.coords.lat')" "49.4444" "geo.coords.lat"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.coords.lng')" "32.0598" "geo.coords.lng"
assert_non_empty "$(json_get "$LAST_BODY" '.data.showroom.geo.geohash')" "geo.geohash"

http_request "PATCH geo (update)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"geo\":{\"city\":\"${GEO_CITY_2}\",\"country\":\"Ukraine\",\"coords\":{\"lat\":47.8388,\"lng\":35.1396},\"placeId\":\"test-place-${NOW}-2\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "GET after geo (update)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.city')" "$GEO_CITY_2" "geo.city updated"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.cityNormalized')" "zaporizhzhia" "geo.cityNormalized updated"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.coords.lat')" "47.8388" "geo.coords.lat updated"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.coords.lng')" "35.1396" "geo.coords.lng updated"
assert_non_empty "$(json_get "$LAST_BODY" '.data.showroom.geo.geohash')" "geo.geohash updated"

print_section "Submit incomplete"
http_request "PATCH force incomplete (clear contacts)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Incomplete ${NOW}\",\"contacts\":{\"phone\":null,\"instagram\":null}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "POST /showrooms/{id}/submit (incomplete)" 400 "SHOWROOM_INCOMPLETE" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID/submit"

print_section "Contacts + merge"
http_request "PATCH step4 (contacts)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"contacts\":{\"phone\":\"+380 (99) 999-99-99\",\"instagram\":\"https://instagram.com/myshowroom${NOW}\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "GET after step4" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

assert_eq "$(json_get "$LAST_BODY" '.data.showroom.contacts.phone')" "+380999999999" "contacts.phone"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.contacts.instagram')" "https://instagram.com/myshowroom${NOW}" "contacts.instagram"

http_request "PATCH contacts (instagram only)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"instagram":"https://instagram.com/newhandle"}}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "GET after instagram-only" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

assert_eq "$(json_get "$LAST_BODY" '.data.showroom.contacts.phone')" "+380999999999" "contacts.phone preserved"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.contacts.instagram')" "https://instagram.com/newhandle" "contacts.instagram updated"

http_request "PATCH contacts (phone only)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"phone":"+380999111223"}}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "GET after phone-only" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

assert_eq "$(json_get "$LAST_BODY" '.data.showroom.contacts.phone')" "+380999111223" "contacts.phone updated"
assert_eq "$(json_get "$LAST_BODY" '.data.showroom.contacts.instagram')" "https://instagram.com/newhandle" "contacts.instagram preserved"

print_section "Validation negatives"
http_request "PATCH invalid name (digits only)" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"11111"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "PATCH invalid name (repeated)" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"aaaaaa"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "PATCH invalid name (symbols)" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"!!!"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "PATCH invalid name (emoji)" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Cool 😎"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "PATCH invalid instagram" 400 "INSTAGRAM_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"instagram":"https://example.com/bad"}}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "PATCH invalid phone" 400 "PHONE_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"phone":"0999999999"}}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

request_allow_status "PATCH blocked country (RU)" 403 400 "COUNTRY_BLOCKED" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"Russia"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

print_section "Submit + pending lock"
http_request "POST /showrooms/{id}/submit" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID/submit"

SUBMIT_STATUS=$(json_get "$LAST_BODY" '.data.showroom.status // empty')
SUBMITTED_NAME=$(json_get "$LAST_BODY" '.data.showroom.name // empty')
SUBMITTED_ADDRESS=$(json_get "$LAST_BODY" '.data.showroom.address // empty')
assert_eq "$SUBMIT_STATUS" "pending" "submit status"

http_request "PATCH pending showroom" 409 "SHOWROOM_LOCKED_PENDING" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Should Fail"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "DELETE pending showroom" 409 "SHOWROOM_LOCKED_PENDING" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

if [[ -n "${TEST_ADMIN_TOKEN:-}" ]]; then
  print_section "Admin approve + geo preserved"
  ADMIN_HEADER=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")

  http_request "POST /admin/showrooms/{id}/approve" 200 "" \
    -X POST "${ADMIN_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/admin/showrooms/$SHOWROOM_ID/approve"

  http_request "GET after approve (geo)" 200 "" \
    "${AUTH_HEADER[@]}" \
    "${BASE_URL}/showrooms/$SHOWROOM_ID"

  assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.city')" "$GEO_CITY_2" "geo.city after approve"
  assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.cityNormalized')" "zaporizhzhia" "geo.cityNormalized after approve"
  GEOHASH=$(json_get "$LAST_BODY" '.data.showroom.geo.geohash // empty')
  assert_non_empty "$GEOHASH" "geo.geohash after approve"

  print_section "City search (public)"
  request_allow_status_or_index_not_ready "GET /showrooms?city=${GEO_CITY_2}" \
    "${BASE_URL}/showrooms?city=${GEO_CITY_2}"
  if [[ "$LAST_STATUS" == "503" ]]; then
    echo "⚠ Firestore index is still building; skipping city search assertion"
  else
    FOUND_COUNT=$(echo "$LAST_BODY" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
    assert_eq "$FOUND_COUNT" "1" "showroom found by city filter"
  fi

  print_section "Search + marker payload"
  assert_non_empty "$GEOHASH" "geo.geohash"
  GEO_PREFIX="${GEOHASH:0:5}"

  LIST_RESPONSE=$(curl -s "${BASE_URL}/showrooms?geohashPrefix=${GEO_PREFIX}&fields=marker&limit=20")
  echo "$LIST_RESPONSE"
  FOUND_COUNT=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
  assert_eq "$FOUND_COUNT" "1" "showroom found by geohashPrefix"

  MARKER_NAME=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .name // empty')
  MARKER_LAT=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .geo.coords.lat // empty')
  MARKER_TYPE=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .type // empty')
  MARKER_CATEGORY=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .category // empty')
  assert_non_empty "$MARKER_NAME" "marker name"
  assert_non_empty "$MARKER_LAT" "marker geo.coords.lat"
  assert_non_empty "$MARKER_TYPE" "marker type"
  assert_eq "$MARKER_CATEGORY" "womenswear" "marker category"

  print_section "Brand + name search (public)"
  LIST_RESPONSE=$(curl -s "${BASE_URL}/showrooms?brand=brand%20a&limit=20")
  echo "$LIST_RESPONSE"
  FOUND_COUNT=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
  assert_eq "$FOUND_COUNT" "1" "showroom found by brand filter"

  NAME_PREFIX="${SUBMITTED_NAME:0:3}"
  LIST_RESPONSE=$(curl -s "${BASE_URL}/showrooms?q=${NAME_PREFIX}&limit=20")
  echo "$LIST_RESPONSE"
  FOUND_COUNT=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
  assert_eq "$FOUND_COUNT" "1" "showroom found by name prefix"

  print_section "qMode=city (public)"
  request_allow_status_or_index_not_ready "GET /showrooms?q=${GEO_CITY_2}&qMode=city&limit=20" \
    "${BASE_URL}/showrooms?q=${GEO_CITY_2}&qMode=city&limit=20"
  if [[ "$LAST_STATUS" == "503" ]]; then
    echo "⚠ Firestore index is still building; skipping qMode=city assertion"
  else
    FOUND_COUNT=$(echo "$LAST_BODY" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
    assert_eq "$FOUND_COUNT" "1" "showroom found by qMode=city"
  fi
else
  echo "⚠ Skipping admin approve + city search (TEST_ADMIN_TOKEN not set)"
fi

print_section "Country change blocked"
http_request "PATCH /users/profile (country change blocked)" 409 "USER_COUNTRY_CHANGE_BLOCKED" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"Poland"}' \
  "${BASE_URL}/users/profile"

http_request "PATCH /users/profile (blocked country)" 403 "COUNTRY_BLOCKED" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"russia"}' \
  "${BASE_URL}/users/profile"

print_section "Duplicate checks (owner)"
http_request "POST /showrooms/create (second showroom)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Seed Showroom","type":"multibrand","country":"Ukraine"}' \
  "${BASE_URL}/showrooms/create"

SECOND_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
assert_non_empty "$SECOND_ID" "second showroom id"

http_request "POST /showrooms/{id}/favorite (stub)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SECOND_ID/favorite"

http_request "PATCH second showroom (set required fields + duplicate name)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${SUBMITTED_NAME}\",\"availability\":\"open\",\"address\":\"${SUBMITTED_ADDRESS}\",\"city\":\"Cherkasy\",\"location\":{\"lat\":49.4444,\"lng\":32.0598},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/newhandle\"}}" \
  "${BASE_URL}/showrooms/$SECOND_ID"

http_request "POST /showrooms/{id}/submit (owner duplicate name)" 400 "SHOWROOM_NAME_ALREADY_EXISTS" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SECOND_ID/submit"

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  print_section "Owner2 token validation"
  OWNER2_AUTH_HEADER=(-H "$(auth_header "${TEST_OWNER_TOKEN_2}")")
  OWNER2_ME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${OWNER2_AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  if [[ "$OWNER2_ME_STATUS" != "200" ]]; then
    echo "⚠ TEST_OWNER_TOKEN_2 invalid; skipping global duplicate tests"
  else
    print_section "Duplicate checks (global)"

  http_request "POST /showrooms/create (other owner draft)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"draft":true}' \
    "${BASE_URL}/showrooms/create?mode=draft"

  OTHER_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$OTHER_ID" "other owner draft id"

  http_request "PATCH other draft (complete fields, duplicate name+address)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${SUBMITTED_NAME}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${SUBMITTED_ADDRESS}\",\"city\":\"Cherkasy\",\"location\":{\"lat\":49.4444,\"lng\":32.0598},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/newhandle\"}}" \
    "${BASE_URL}/showrooms/$OTHER_ID"

  http_request "POST /showrooms/{id}/submit (global duplicate)" 400 "SHOWROOM_DUPLICATE" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$OTHER_ID/submit"
  fi
else
  echo "⚠ Skipping global duplicate test (TEST_OWNER_TOKEN_2 not set)"
fi

print_section "Address normalization duplicate"
http_request "POST /showrooms/draft (E)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_E_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_E_ID" "showroom E id"

NAME_E="Address Norm ${NOW}"
ADDRESS_E="Cherkasy ,  Shevchenka Ave 1"

http_request "PATCH E (messy address)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_E}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_E}\",\"city\":\"Cherkasy\",\"location\":{\"lat\":49.4444,\"lng\":32.0598},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_E_ID"

http_request "SUBMIT E" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SHOWROOM_E_ID/submit"

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  OWNER2_AUTH_HEADER=(-H "$(auth_header "${TEST_OWNER_TOKEN_2}")")

  http_request "OWNER2 /showrooms/draft (F)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_F_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_F_ID" "showroom F id"

  http_request "OWNER2 PATCH F (normalized address)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_E}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"cherkasy, shevchenka ave 1\",\"city\":\"Cherkasy\",\"location\":{\"lat\":49.4444,\"lng\":32.0598},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_F_ID"

  http_request "OWNER2 SUBMIT F (duplicate)" 400 "SHOWROOM_DUPLICATE" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$SHOWROOM_F_ID/submit"
else
  echo "⚠ Skipping address normalization duplicate (TEST_OWNER_TOKEN_2 not set)"
fi

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  print_section "Draft does not block global duplicate"
  OWNER2_AUTH_HEADER=(-H "$(auth_header "${TEST_OWNER_TOKEN_2}")")

  http_request "POST /showrooms/draft (G)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_G_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_G_ID" "showroom G id"

  NAME_G="Draft Only ${NOW}"
  ADDRESS_G="Zaporizhzhia, Sobornyi Ave 2"

  http_request "PATCH G (draft only)" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_G}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_G}\",\"city\":\"Zaporizhzhia\",\"location\":{\"lat\":47.8388,\"lng\":35.1396},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_G_ID"

  http_request "OWNER2 /showrooms/draft (H)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_H_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_H_ID" "showroom H id"

  http_request "OWNER2 PATCH H (same as draft G)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_G}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_G}\",\"city\":\"Zaporizhzhia\",\"location\":{\"lat\":47.8388,\"lng\":35.1396},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_H_ID"

  http_request "OWNER2 SUBMIT H (should not fail due to draft)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$SHOWROOM_H_ID/submit"
else
  echo "⚠ Skipping draft does not block global duplicate (TEST_OWNER_TOKEN_2 not set)"
fi

print_section "RESULT"
echo "✔ Showrooms tests passed"
