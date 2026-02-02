#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running Showroom Uniqueness/Anti-spam tests with NODE_ENV=$ENV"

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

throttle() {
  sleep 1
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

#####################################
# AUTH + ROLE
#####################################
print_section "Auth + role"
ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
echo "$ME_RESPONSE"
USER_ROLE=$(echo "$ME_RESPONSE" | jq -r '.data.role // empty')
if [[ -z "$USER_ROLE" ]]; then
  fail "role missing in /users/me"
fi

if [[ "$USER_ROLE" != "owner" ]]; then
  request "POST /users/complete-owner-profile (upgrade)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Owner ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner${NOW}\"}" \
    "${BASE_URL}/users/complete-owner-profile"

  ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  echo "$ME_RESPONSE"
  USER_ROLE=$(echo "$ME_RESPONSE" | jq -r '.data.role // empty')
  assert_eq "$USER_ROLE" "owner" "role"
fi

#####################################
# OWNER DUPLICATE NAME (case-insensitive)
#####################################
print_section "Owner duplicate name"

request "POST /showrooms/draft (A)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_A_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_A_ID" "showroom A id"

NAME_A="My Showroom 01 ${NOW}"
ADDRESS_A="Kyiv, Khreshchatyk 1"

request "PATCH A (valid fields)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_A}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_A}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_A_ID"

NAME_A_USED=$(echo "$BODY" | jq -r '.data.showroom.name // empty')
ADDRESS_A_USED=$(echo "$BODY" | jq -r '.data.showroom.address // empty')
assert_non_empty "$NAME_A_USED" "name A used"
assert_non_empty "$ADDRESS_A_USED" "address A used"

request "SUBMIT A" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SHOWROOM_A_ID/submit"
throttle

A_STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$A_STATUS" "pending" "A status"

request "POST /showrooms/draft (B)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_B_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_B_ID" "showroom B id"

NAME_B="  my   showroom 01 ${NOW} "

request "PATCH B (name variant)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_B}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_A}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_B_ID"

request "SUBMIT B (owner duplicate)" 400 "SHOWROOM_NAME_ALREADY_EXISTS" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SHOWROOM_B_ID/submit"

#####################################
# GLOBAL DUPLICATE (owner2)
#####################################
if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  print_section "Global duplicate (owner2)"
  OWNER2_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_OWNER_TOKEN_2}")
  OWNER2_ME=$(curl -s "${OWNER2_AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  OWNER2_ROLE=$(echo "$OWNER2_ME" | jq -r '.data.role // empty')
  if [[ "$OWNER2_ROLE" != "owner" ]]; then
    request "OWNER2 /users/complete-owner-profile (upgrade)" 200 "" \
      -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
      -d "{\"name\":\"Owner2 ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner2${NOW}\"}" \
      "${BASE_URL}/users/complete-owner-profile"
  fi

  request "OWNER2 /showrooms/draft (C)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_C_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_C_ID" "showroom C id"

  request "OWNER2 PATCH C (duplicate)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_A_USED}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_A_USED}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_C_ID"

  request "OWNER2 SUBMIT C (duplicate)" 400 "SHOWROOM_DUPLICATE" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$SHOWROOM_C_ID/submit"
  throttle
else
  echo "⚠ Skipping global duplicate (TEST_OWNER_TOKEN_2 not set)"
fi

#####################################
# ANTI-SPAM NAME VALIDATION
#####################################
print_section "Anti-spam name validation"

request "POST /showrooms/draft (D)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_D_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_D_ID" "showroom D id"

request "PATCH name digits only" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"11111"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_D_ID"

request "PATCH name repeats" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"aaaaaa"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_D_ID"

request "PATCH name symbols" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"!!!"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_D_ID"

request "PATCH name emoji" 400 "SHOWROOM_NAME_INVALID" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Cool 😎"}' \
  "${BASE_URL}/showrooms/$SHOWROOM_D_ID"

#####################################
# ADDRESS NORMALIZATION + DUPLICATE
#####################################
print_section "Address normalization duplicate"

request "POST /showrooms/draft (E)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_E_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_E_ID" "showroom E id"

NAME_E="Address Norm ${NOW}"
ADDRESS_E="Kyiv ,  Khreshchatyk 1"

request "PATCH E (messy address)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_E}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_E}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
  "${BASE_URL}/showrooms/$SHOWROOM_E_ID"

request "SUBMIT E" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/$SHOWROOM_E_ID/submit"
throttle

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  OWNER2_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_OWNER_TOKEN_2}")
  OWNER2_ME=$(curl -s "${OWNER2_AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  OWNER2_ROLE=$(echo "$OWNER2_ME" | jq -r '.data.role // empty')
  if [[ "$OWNER2_ROLE" != "owner" ]]; then
    request "OWNER2 /users/complete-owner-profile (upgrade)" 200 "" \
      -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
      -d "{\"name\":\"Owner2 ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner2${NOW}\"}" \
      "${BASE_URL}/users/complete-owner-profile"
  fi

  request "OWNER2 /showrooms/draft (F)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_F_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_F_ID" "showroom F id"

  request "OWNER2 PATCH F (normalized address)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_E}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"kyiv,khreshchatyk 1\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.45,\"lng\":30.52},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_F_ID"

  request "OWNER2 SUBMIT F (duplicate)" 400 "SHOWROOM_DUPLICATE" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$SHOWROOM_F_ID/submit"
  throttle
else
  echo "⚠ Skipping address normalization duplicate (TEST_OWNER_TOKEN_2 not set)"
fi

#####################################
# DRAFT DOES NOT BLOCK GLOBAL DUPLICATE
#####################################
print_section "Draft does not block global duplicate"

if [[ -n "${TEST_OWNER_TOKEN_2:-}" ]]; then
  OWNER2_AUTH_HEADER=(-H "Authorization: Bearer ${TEST_OWNER_TOKEN_2}")
  OWNER2_ME=$(curl -s "${OWNER2_AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  OWNER2_ROLE=$(echo "$OWNER2_ME" | jq -r '.data.role // empty')
  if [[ "$OWNER2_ROLE" != "owner" ]]; then
    request "OWNER2 /users/complete-owner-profile (upgrade)" 200 "" \
      -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
      -d "{\"name\":\"Owner2 ${NOW}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/owner2${NOW}\"}" \
      "${BASE_URL}/users/complete-owner-profile"
  fi

  request "POST /showrooms/draft (G)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_G_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_G_ID" "showroom G id"

  NAME_G="Draft Only ${NOW}"
  ADDRESS_G="Kyiv, Khreshchatyk 2"

  request "PATCH G (draft only)" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_G}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_G}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.46,\"lng\":30.53},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_G_ID"

  request "OWNER2 /showrooms/draft (H)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  SHOWROOM_H_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
  assert_non_empty "$SHOWROOM_H_ID" "showroom H id"

  request "OWNER2 PATCH H (same as draft G)" 200 "" \
    -X PATCH "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${NAME_G}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"availability\":\"open\",\"address\":\"${ADDRESS_G}\",\"city\":\"Kyiv\",\"location\":{\"lat\":50.46,\"lng\":30.53},\"contacts\":{\"phone\":\"+380999111223\",\"instagram\":\"https://instagram.com/showroom${NOW}\"}}" \
    "${BASE_URL}/showrooms/$SHOWROOM_H_ID"

  request "OWNER2 SUBMIT H (should not fail due to draft)" 200 "" \
    -X POST "${OWNER2_AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/$SHOWROOM_H_ID/submit"
  throttle
else
  echo "⚠ Skipping draft does not block global duplicate (TEST_OWNER_TOKEN_2 not set)"
fi

#####################################
# FINAL RESULT
#####################################
print_section "RESULT"
echo "✔ Uniqueness + anti-spam verified"
