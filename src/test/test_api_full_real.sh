#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running Smoke+ API tests with NODE_ENV=$ENV"

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

#####################################
# PUBLIC API
#####################################
print_section "Public API"
request "GET /health" 200 "" "${BASE_URL}/health"
request "GET /showrooms" 200 "" "${BASE_URL}/showrooms"

#####################################
# AUTH CONTRACT
#####################################
print_section "Auth contract (no token)"
request "GET /users/me (unauth)" 401 "AUTH_MISSING" "${BASE_URL}/users/me"
request "POST /users/complete-onboarding (unauth)" 401 "AUTH_MISSING" \
  -X POST "${JSON_HEADER[@]}" \
  -d '{"country":"Ukraine"}' \
  "${BASE_URL}/users/complete-onboarding"

#####################################
# AUTH CONTRACT (with token)
#####################################
print_section "Auth contract (with token)"

ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
echo "$ME_RESPONSE"

USER_ROLE=$(echo "$ME_RESPONSE" | jq -r '.data.role')
ONBOARDING_STATE=$(echo "$ME_RESPONSE" | jq -r '.data.onboardingState')

[ -n "$USER_ROLE" ] || fail "role missing in /users/me"
[ -n "$ONBOARDING_STATE" ] || fail "onboardingState missing in /users/me"

echo "✔ role=$USER_ROLE onboardingState=$ONBOARDING_STATE"

#####################################
# COUNTRY RESTRICTIONS
#####################################
print_section "Country restrictions"

request "POST /users/complete-onboarding (UA)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"Ukraine"}' \
  "${BASE_URL}/users/complete-onboarding"

request "POST /users/complete-onboarding (RU blocked)" 403 "COUNTRY_BLOCKED" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"Russia"}' \
  "${BASE_URL}/users/complete-onboarding"

#####################################
# RBAC (ALL ROLES)
#####################################
print_section "RBAC"

if [[ "$USER_ROLE" == "user" ]]; then
  request "USER → POST /showrooms/create" 403 "FORBIDDEN" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"name":"Test","country":"Ukraine","type":"multibrand"}' \
    "${BASE_URL}/showrooms/create"
else
  echo "⚠ Skipping USER RBAC check (role=$USER_ROLE)"
fi

request "USER → POST /lookbooks/create" 403 "FORBIDDEN" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Test"}' \
  "${BASE_URL}/lookbooks/create"

#####################################
# OWNER FLOW (SAFE)
#####################################
if [[ "$USER_ROLE" == "owner" ]]; then
  print_section "Owner showroom flow"

  CREATE_BODY='{
    "name":"Smoke Showroom",
    "type":"multibrand",
    "country":"Ukraine"
  }'

  CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/showrooms/create" \
    "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "$CREATE_BODY")

  SHOWROOM_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.showroom.id // empty')
  [ -n "$SHOWROOM_ID" ] || fail "showroom.id missing"

  echo "✔ Created showroom $SHOWROOM_ID"

  request "GET /showrooms/{id}" 200 "" \
    "${BASE_URL}/showrooms/$SHOWROOM_ID"

  request "PATCH /showrooms/{id}" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"name":"Updated Smoke Showroom"}' \
    "${BASE_URL}/showrooms/$SHOWROOM_ID"

  request "POST /showrooms/{id}/favorite" 200 "" \
    -X POST "${AUTH_HEADER[@]}" \
    "${BASE_URL}/showrooms/$SHOWROOM_ID/favorite"
else
  echo "⚠ Skipping owner flow (role=$USER_ROLE)"
fi

#####################################
# FINAL RESULT
#####################################
print_section "RESULT"
echo "✔ Smoke+ API contract verified"
