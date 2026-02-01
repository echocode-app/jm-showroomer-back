#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running Showroom Draft Flow tests with NODE_ENV=$ENV"

ENV_FILE=".env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found"
  exit 1
fi

export $(grep -v '^#' "$ENV_FILE" | grep -v FIREBASE_PRIVATE_KEY | xargs)

if [ -z "${TEST_USER_TOKEN:-}" ]; then
  echo "❌ TEST_USER_TOKEN is required"
  exit 1
fi

BASE_URL="${BASE_URL:?BASE_URL is required}"
AUTH_HEADER=(-H "Authorization: Bearer ${TEST_USER_TOKEN}")
JSON_HEADER=(-H "Content-Type: application/json")
NOW=$(date +%s%N)

#####################################
# HELPERS
#####################################
print_section() {
  echo
  echo "====================================="
  echo " $1"
  echo "====================================="
}

fail() {
  echo "❌ $1"
  exit 1
}

assert_eq() {
  local actual=$1
  local expected=$2
  local label=${3:-"value"}
  if [[ "$actual" != "$expected" ]]; then
    fail "Expected $label=$expected, got $actual"
  fi
}

assert_non_empty() {
  local value=$1
  local label=${2:-"value"}
  if [[ -z "$value" || "$value" == "null" ]]; then
    fail "$label is empty"
  fi
}

assert_gt() {
  local current=$1
  local prev=$2
  local label=${3:-"value"}
  if (( current <= prev )); then
    fail "Expected $label to increase (prev=$prev, current=$current)"
  fi
}

request() {
  local label=$1
  local expected_status=$2
  local expected_error_code=${3:-}
  shift 3 || true

  echo
  echo "▶ $label"

  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$@")
  LAST_STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
  LAST_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  echo "$LAST_BODY"

  if [[ "$LAST_STATUS" != "$expected_status" ]]; then
    fail "Expected HTTP $expected_status, got $LAST_STATUS"
  fi

  if [[ -n "$expected_error_code" ]]; then
    CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
    if [[ "$CODE" != "$expected_error_code" ]]; then
      fail "Expected error.code=$expected_error_code, got $CODE"
    fi
  fi

  echo "✔ HTTP $LAST_STATUS"
}

request_allow_status() {
  local label=$1
  local expected_status_1=$2
  local expected_status_2=$3
  local expected_error_code=${4:-}
  shift 4 || true

  echo
  echo "▶ $label"

  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$@")
  LAST_STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
  LAST_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  echo "$LAST_BODY"

  if [[ "$LAST_STATUS" != "$expected_status_1" && "$LAST_STATUS" != "$expected_status_2" ]]; then
    fail "Expected HTTP $expected_status_1 or $expected_status_2, got $LAST_STATUS"
  fi

  if [[ -n "$expected_error_code" ]]; then
    CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
    if [[ "$CODE" != "$expected_error_code" ]]; then
      fail "Expected error.code=$expected_error_code, got $CODE"
    fi
  fi

  echo "✔ HTTP $LAST_STATUS"
}

#####################################
# AUTH CHECK
#####################################
print_section "Auth check"
ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
echo "$ME_RESPONSE"

USER_ROLE=$(echo "$ME_RESPONSE" | jq -r '.data.role // empty')
if [[ -z "$USER_ROLE" ]]; then
  fail "role missing in /users/me"
fi

if [[ "$USER_ROLE" != "owner" ]]; then
  NOW=$(date +%s%N)
  request "POST /users/complete-owner-profile (upgrade)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Owner ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner${NOW}\"}" \
    "${BASE_URL}/users/complete-owner-profile"

  ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  USER_ROLE=$(echo "$ME_RESPONSE" | jq -r '.data.role // empty')
  if [[ "$USER_ROLE" != "owner" ]]; then
    fail "Expected role=owner after upgrade, got $USER_ROLE"
  fi
fi

#####################################
# DRAFT CREATION / REUSE
#####################################
print_section "Draft creation"
request "POST /showrooms/draft" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

DRAFT_ID=$(echo "$LAST_BODY" | jq -r '.data.showroom.id // empty')
DRAFT_STATUS=$(echo "$LAST_BODY" | jq -r '.data.showroom.status // empty')
assert_non_empty "$DRAFT_ID" "draft id"
assert_eq "$DRAFT_STATUS" "draft" "draft status"

request "POST /showrooms/create?mode=draft (reuse)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"draft":true}' \
  "${BASE_URL}/showrooms/create?mode=draft"

DRAFT_ID_2=$(echo "$LAST_BODY" | jq -r '.data.showroom.id // empty')
assert_eq "$DRAFT_ID_2" "$DRAFT_ID" "draft id reuse"

#####################################
# PARTIAL UPDATES
#####################################
print_section "Partial updates"

request "GET /showrooms/{id}" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

EDIT_COUNT=$(echo "$LAST_BODY" | jq -r '.data.showroom.editCount // 0')
EDIT_HISTORY_LEN=$(echo "$LAST_BODY" | jq '.data.showroom.editHistory | length')

NAME_STEP1="My Showroom 01 ${NOW}"
request "PATCH step1 (name/type)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_STEP1}\",\"type\":\"multibrand\"}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "GET after step1" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.name')" "$NAME_STEP1" "name"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.type')" "multibrand" "type"
CURRENT_AVAILABILITY=$(echo "$LAST_BODY" | jq -r '.data.showroom.availability // empty')
if [[ "$CURRENT_AVAILABILITY" == "open" ]]; then
  AVAILABILITY_NEXT="appointment"
else
  AVAILABILITY_NEXT="open"
fi
NEW_EDIT_COUNT=$(echo "$LAST_BODY" | jq -r '.data.showroom.editCount // 0')
NEW_EDIT_HISTORY_LEN=$(echo "$LAST_BODY" | jq '.data.showroom.editHistory | length')
assert_gt "$NEW_EDIT_COUNT" "$EDIT_COUNT" "editCount"
assert_gt "$NEW_EDIT_HISTORY_LEN" "$EDIT_HISTORY_LEN" "editHistory length"
EDIT_COUNT=$NEW_EDIT_COUNT
EDIT_HISTORY_LEN=$NEW_EDIT_HISTORY_LEN

request "PATCH step2 (country/availability)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"country\":\"Ukraine\",\"availability\":\"${AVAILABILITY_NEXT}\"}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "GET after step2" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.country')" "Ukraine" "country"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.availability')" "$AVAILABILITY_NEXT" "availability"
NEW_EDIT_COUNT=$(echo "$LAST_BODY" | jq -r '.data.showroom.editCount // 0')
NEW_EDIT_HISTORY_LEN=$(echo "$LAST_BODY" | jq '.data.showroom.editHistory | length')
assert_gt "$NEW_EDIT_COUNT" "$EDIT_COUNT" "editCount"
assert_gt "$NEW_EDIT_HISTORY_LEN" "$EDIT_HISTORY_LEN" "editHistory length"
EDIT_COUNT=$NEW_EDIT_COUNT
EDIT_HISTORY_LEN=$NEW_EDIT_HISTORY_LEN

request "PATCH step3 (address/city/location)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"address\":\"Kyiv, Khreshchatyk ${NOW}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52}}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "GET after step3" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.address')" "Kyiv, Khreshchatyk ${NOW}" "address"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.city')" "Kyiv" "city"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.location.lat')" "50.45" "location.lat"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.location.lng')" "30.52" "location.lng"
NEW_EDIT_COUNT=$(echo "$LAST_BODY" | jq -r '.data.showroom.editCount // 0')
NEW_EDIT_HISTORY_LEN=$(echo "$LAST_BODY" | jq '.data.showroom.editHistory | length')
assert_gt "$NEW_EDIT_COUNT" "$EDIT_COUNT" "editCount"
assert_gt "$NEW_EDIT_HISTORY_LEN" "$EDIT_HISTORY_LEN" "editHistory length"
EDIT_COUNT=$NEW_EDIT_COUNT
EDIT_HISTORY_LEN=$NEW_EDIT_HISTORY_LEN

#####################################
# SUBMIT INCOMPLETE
#####################################
print_section "Submit incomplete"
request "PATCH force incomplete (clear contacts)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Incomplete ${NOW}\",\"contacts\":{\"phone\":null,\"instagram\":null}}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "POST /showrooms/{id}/submit (incomplete)" 400 "SHOWROOM_INCOMPLETE" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$DRAFT_ID/submit"

#####################################
# CONTACTS STEP + MERGE
#####################################
print_section "Contacts + merge"
request "PATCH step4 (contacts)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"contacts\":{\"phone\":\"+380 (99) 999-99-99\",\"instagram\":\"https://instagram.com/myshowroom${NOW}\"}}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "GET after step4" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.contacts.phone')" "+380999999999" "contacts.phone"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.contacts.instagram')" "https://instagram.com/myshowroom${NOW}" "contacts.instagram"

request "PATCH contacts (instagram only)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"instagram":"https://instagram.com/newhandle"}}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "GET after instagram-only" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.contacts.phone')" "+380999999999" "contacts.phone preserved"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.contacts.instagram')" "https://instagram.com/newhandle" "contacts.instagram updated"

request "PATCH contacts (phone only)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"phone":"+380999111223"}}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "GET after phone-only" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$DRAFT_ID"

assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.contacts.phone')" "+380999111223" "contacts.phone updated"
assert_eq "$(echo "$LAST_BODY" | jq -r '.data.showroom.contacts.instagram')" "https://instagram.com/newhandle" "contacts.instagram preserved"

#####################################
# VALIDATION NEGATIVES
#####################################
print_section "Validation negatives"

request "PATCH invalid name (digits only)" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"11111"}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "PATCH invalid name (repeated)" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"aaaaaa"}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "PATCH invalid instagram" 400 "INSTAGRAM_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"instagram":"https://example.com/bad"}}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request "PATCH invalid phone" 400 "PHONE_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"phone":"0999999999"}}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

request_allow_status "PATCH blocked country (RU)" 403 400 "COUNTRY_BLOCKED" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"Russia"}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

#####################################
# SUBMIT SUCCESS
#####################################
print_section "Submit success"
request "POST /showrooms/{id}/submit" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$DRAFT_ID/submit"

SUBMIT_STATUS=$(echo "$LAST_BODY" | jq -r '.data.showroom.status // empty')
SUBMITTED_AT=$(echo "$LAST_BODY" | jq -r '.data.showroom.submittedAt // empty')
SUBMITTED_NAME=$(echo "$LAST_BODY" | jq -r '.data.showroom.name // empty')
SUBMITTED_ADDRESS=$(echo "$LAST_BODY" | jq -r '.data.showroom.address // empty')
assert_eq "$SUBMIT_STATUS" "pending" "submit status"
assert_non_empty "$SUBMITTED_AT" "submittedAt"

#####################################
# LOCK EDITING AFTER SUBMIT
#####################################
print_section "Lock after submit"
request "PATCH pending showroom" 400 "SHOWROOM_NOT_EDITABLE" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Should Fail"}' \
  "${BASE_URL}/showrooms/$DRAFT_ID"

#####################################
# DUPLICATE CHECKS (OWNER)
#####################################
print_section "Duplicate checks (owner)"

request "POST /showrooms/create (second showroom)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Seed Showroom","type":"multibrand","country":"Ukraine"}' \
  "${BASE_URL}/showrooms/create"

SECOND_ID=$(echo "$LAST_BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SECOND_ID" "second showroom id"

request "PATCH second showroom (set required fields + duplicate name)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${SUBMITTED_NAME}\",\"availability\":\"open\",\"address\":\"${SUBMITTED_ADDRESS}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/newhandle\"}}" \
  "${BASE_URL}/showrooms/$SECOND_ID"

request "POST /showrooms/{id}/submit (owner duplicate name)" 400 "SHOWROOM_NAME_ALREADY_EXISTS" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SECOND_ID/submit"

#####################################
# DUPLICATE CHECKS (GLOBAL)
#####################################
if [[ -n "${SECOND_OWNER_TOKEN:-}" ]]; then
  print_section "Duplicate checks (global)"

  OTHER_AUTH_HEADER=(-H "Authorization: Bearer ${SECOND_OWNER_TOKEN}")

  request "POST /showrooms/create (other owner draft)" 200 "" \
    -X POST "${OTHER_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"draft":true}' \
    "${BASE_URL}/showrooms/create?mode=draft"

  OTHER_ID=$(echo "$LAST_BODY" | jq -r '.data.showroom.id // empty')
  assert_non_empty "$OTHER_ID" "other owner draft id"

  request "PATCH other draft (complete fields, duplicate name+address)" 200 "" \
    -X PATCH "${OTHER_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"name":"My Showroom 01","type":"multibrand","country":"Ukraine","availability":"open","address":"Kyiv, Khreshchatyk 1","city":"Kyiv","location":{"lat":50.45,"lng":30.52},"contacts":{"phone":"+380999111223","instagram":"https://instagram.com/newhandle"}}' \
    "${BASE_URL}/showrooms/$OTHER_ID"

  request "POST /showrooms/{id}/submit (global duplicate)" 400 "SHOWROOM_DUPLICATE" \
    -X POST "${OTHER_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$OTHER_ID/submit"
else
  echo "⚠ Skipping global duplicate test (SECOND_OWNER_TOKEN not set)"
fi

#####################################
# FINAL RESULT
#####################################
print_section "RESULT"
echo "✔ Showroom draft flow verified"
