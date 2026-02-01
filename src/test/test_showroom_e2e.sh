#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running Showroom E2E tests with NODE_ENV=$ENV"

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

request() {
  local label=$1
  local expected_status=$2
  local expected_error_code=${3:-}
  shift 3 || true

  echo
  echo "▶ $label"

  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$@")
  STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
  BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  echo "$BODY"

  if [[ "$STATUS" != "$expected_status" ]]; then
    fail "Expected HTTP $expected_status, got $STATUS"
  fi

  if [[ -n "$expected_error_code" ]]; then
    CODE=$(echo "$BODY" | jq -r '.error.code // empty')
    if [[ "$CODE" != "$expected_error_code" ]]; then
      fail "Expected error.code=$expected_error_code, got $CODE"
    fi
  fi

  echo "✔ HTTP $STATUS"
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

#####################################
# PUBLIC ENDPOINTS
#####################################
print_section "Public endpoints"
request "GET /showrooms" 200 "" "${BASE_URL}/showrooms"

#####################################
# AUTH NEGATIVE
#####################################
print_section "Auth negative"
request "GET /users/me (no auth)" 401 "AUTH_MISSING" \
  "${BASE_URL}/users/me"

request "GET /users/me (invalid auth)" 401 "AUTH_INVALID" \
  -H "Authorization: Bearer invalid" \
  "${BASE_URL}/users/me"

#####################################
# AUTH
#####################################
print_section "Auth"
ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
echo "$ME_RESPONSE"
USER_ROLE=$(echo "$ME_RESPONSE" | jq -r '.data.role // empty')
if [[ -z "$USER_ROLE" ]]; then
  fail "role missing in /users/me"
fi

#####################################
# OWNER UPGRADE (via owner profile)
#####################################
print_section "Owner profile upgrade"
if [[ "$USER_ROLE" != "owner" ]]; then
  request "POST /users/complete-owner-profile" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Owner ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner${NOW}\"}" \
    "${BASE_URL}/users/complete-owner-profile"

  ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  echo "$ME_RESPONSE"
  USER_ROLE=$(echo "$ME_RESPONSE" | jq -r '.data.role // empty')
  if [[ "$USER_ROLE" != "owner" ]]; then
    fail "Expected role=owner, got $USER_ROLE"
  fi
fi

print_section "Country blocked (onboarding)"
request "POST /users/complete-onboarding (blocked)" 403 "COUNTRY_BLOCKED" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"russia"}' \
  "${BASE_URL}/users/complete-onboarding"

print_section "Country blocked (showrooms create)"
request "POST /showrooms/create (blocked)" 403 "COUNTRY_BLOCKED" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Blocked Showroom","type":"multibrand","country":"russia"}' \
  "${BASE_URL}/showrooms/create"

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  OWNER2_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_OWNER_TOKEN_2}")
  OWNER2_ME=$(curl -s "${OWNER2_AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  OWNER2_ROLE=$(echo "$OWNER2_ME" | jq -r '.data.role // empty')
  if [[ "$OWNER2_ROLE" != "owner" ]]; then
    request "POST /users/complete-owner-profile (owner2)" 200 "" \
      -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
      -d "{\"name\":\"Owner2 ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner2${NOW}\"}" \
      "${BASE_URL}/users/complete-owner-profile"
  fi
fi

#####################################
# RBAC NEGATIVE
#####################################
print_section "RBAC (negative check)"
# If a separate user token is provided, verify access denied
if [[ -n "${TEST_USER_TOKEN_USER:-}" ]]; then
  USER_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_USER_TOKEN_USER}")
  request "USER → POST /showrooms/draft" 403 "FORBIDDEN" \
    -X POST "${USER_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"
fi

#####################################
# DRAFT FLOW
#####################################
print_section "Draft flow"
NAME_MAIN="My Showroom 01 ${NOW}"
request "POST /showrooms/draft" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_non_empty "$SHOWROOM_ID" "showroom id"
assert_eq "$STATUS" "draft" "status"

request "GET /showrooms/{id}" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

EDIT_COUNT=$(echo "$BODY" | jq -r '.data.showroom.editCount // 0')

request "PATCH step1 (name/type)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_MAIN}\",\"type\":\"multibrand\"}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

request "GET after step1" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

NEW_EDIT_COUNT=$(echo "$BODY" | jq -r '.data.showroom.editCount // 0')
assert_gt "$NEW_EDIT_COUNT" "$EDIT_COUNT" "editCount"
EDIT_COUNT=$NEW_EDIT_COUNT

CURRENT_AVAILABILITY=$(echo "$BODY" | jq -r '.data.showroom.availability // empty')
if [[ "$CURRENT_AVAILABILITY" == "open" ]]; then
  AVAILABILITY_NEXT="appointment"
else
  AVAILABILITY_NEXT="open"
fi

request "PATCH step2 (country/availability)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"country\":\"Ukraine\",\"availability\":\"${AVAILABILITY_NEXT}\"}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

request "PATCH step3 (address/city/location)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"address\":\"Kyiv, Khreshchatyk ${NOW}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

request "PATCH step4 (contacts)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"contacts\":{\"phone\":\"+380 (99) 999-99-99\",\"instagram\":\"https://instagram.com/myshowroom${NOW}\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

#####################################
# VALIDATION NEGATIVES
#####################################
print_section "Validation negatives"

request "PATCH invalid name" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"11111"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

request "PATCH invalid instagram" 400 "INSTAGRAM_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"instagram":"https://example.com/bad"}}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

request "PATCH invalid phone" 400 "PHONE_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"contacts":{"phone":"abc"}}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

request "PATCH blocked country" 403 "COUNTRY_BLOCKED" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"Russia"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

#####################################
# SUBMIT
#####################################
print_section "Submit"
request "POST /showrooms/{id}/submit" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID/submit"

SUBMIT_STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$SUBMIT_STATUS" "pending" "status"

request "PATCH pending showroom" 400 "SHOWROOM_NOT_EDITABLE" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Should Fail"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_ID"

#####################################
# DUPLICATE CHECKS
#####################################
print_section "Duplicate checks"

request "POST /showrooms/create (second showroom)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Seed Showroom","type":"multibrand","country":"Ukraine"}' \
  "${BASE_URL}/showrooms/create"

SECOND_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SECOND_ID" "second showroom id"

request "PATCH second showroom (set duplicate name)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_MAIN}\",\"availability\":\"open\",\"address\":\"Kyiv, Khreshchatyk 1\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/myshowroom\"}}" \
  "${BASE_URL}/showrooms/$SECOND_ID"

request "POST /showrooms/{id}/submit (owner duplicate name)" 400 "SHOWROOM_NAME_ALREADY_EXISTS" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SECOND_ID/submit"

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  print_section "Duplicate checks (owner2)"

  OWNER2_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_OWNER_TOKEN_2}")

  request "OWNER2 → POST /showrooms/draft" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  OWNER2_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
  assert_non_empty "$OWNER2_ID" "owner2 showroom id"

  request "OWNER2 → PATCH draft (duplicate name+address)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"name":"My Showroom 01","type":"multibrand","country":"Ukraine","availability":"open","address":"Kyiv, Khreshchatyk 1","city":"Kyiv","location":{"lat":50.45,"lng":30.52},"contacts":{"phone":"+380999111223","instagram":"https://instagram.com/myshowroom"}}' \
    "${BASE_URL}/showrooms/$OWNER2_ID"

  request "OWNER2 → POST /showrooms/{id}/submit (duplicate)" 400 "SHOWROOM_DUPLICATE" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$OWNER2_ID/submit"
fi

#####################################
# ACCESS DENIED
#####################################
print_section "Access denied"
# Use a different user token if provided, otherwise skip
if [[ -n "${TEST_USER_TOKEN_USER:-}" ]]; then
  USER_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_USER_TOKEN_USER}")
  request "USER → POST /showrooms/{id}/submit" 403 "FORBIDDEN" \
    -X POST "${USER_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$SHOWROOM_ID/submit"
fi

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  OWNER2_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_OWNER_TOKEN_2}")
  request "OWNER2 → POST /showrooms/{id}/submit" 403 "ACCESS_DENIED" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$SHOWROOM_ID/submit"
fi

#####################################
# FINAL RESULT
#####################################
print_section "RESULT"
echo "✔ Showroom E2E flow verified"
