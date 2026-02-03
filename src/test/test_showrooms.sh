#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq
require_env BASE_URL TEST_USER_TOKEN

BASE_URL="${BASE_URL}"
AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")
NOW=$(now_ns)

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
ADDRESS_MAIN="Kyiv, Khreshchatyk ${NOW}"

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
  -d "{\"country\":\"Ukraine\",\"availability\":\"${AVAILABILITY_NEXT}\"}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

http_request "PATCH step3 (address/city/location)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"address\":\"${ADDRESS_MAIN}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

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
  -d "{\"name\":\"${SUBMITTED_NAME}\",\"availability\":\"open\",\"address\":\"${SUBMITTED_ADDRESS}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/newhandle\"}}" \
  "${BASE_URL}/showrooms/$SECOND_ID"

http_request "POST /showrooms/{id}/submit (owner duplicate name)" 400 "SHOWROOM_NAME_ALREADY_EXISTS" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SECOND_ID/submit"

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  print_section "Duplicate checks (global)"
  OWNER2_AUTH_HEADER=(-H "$(auth_header "${TEST_OWNER_TOKEN_2}")")

  http_request "POST /showrooms/create (other owner draft)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"draft":true}' \
    "${BASE_URL}/showrooms/create?mode=draft"

  OTHER_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$OTHER_ID" "other owner draft id"

  http_request "PATCH other draft (complete fields, duplicate name+address)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${SUBMITTED_NAME}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${SUBMITTED_ADDRESS}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/newhandle\"}}" \
    "${BASE_URL}/showrooms/$OTHER_ID"

  http_request "POST /showrooms/{id}/submit (global duplicate)" 400 "SHOWROOM_DUPLICATE" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$OTHER_ID/submit"
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
ADDRESS_E="Kyiv ,  Khreshchatyk 1"

http_request "PATCH E (messy address)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_E}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_E}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
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
    -d "{\"name\":\"${NAME_E}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"kyiv,khreshchatyk 1\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
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
  ADDRESS_G="Kyiv, Khreshchatyk 2"

  http_request "PATCH G (draft only)" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_G}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_G}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.46,\"lng\":30.53},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_G_ID"

  http_request "OWNER2 /showrooms/draft (H)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_H_ID=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_H_ID" "showroom H id"

  http_request "OWNER2 PATCH H (same as draft G)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_G}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_G}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.46,\"lng\":30.53},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
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
