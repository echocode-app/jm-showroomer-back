#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running User Profile tests with NODE_ENV=$ENV"

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
# PREFLIGHT
#####################################
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
if [[ "$HEALTH_STATUS" != "200" ]]; then
  echo "❌ Server not running, start with: npm run dev"
  exit 1
fi

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
# AUTH CHECK
#####################################
print_section "Auth check"
ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
echo "$ME_RESPONSE"

#####################################
# BASIC PROFILE UPDATE
#####################################
print_section "Profile update"
request "PATCH /users/profile (settings)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"appLanguage":"uk","notificationsEnabled":true}' \
  "${BASE_URL}/users/profile"

request "PATCH /users/profile (name)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Profile Name ${NOW}\"}" \
  "${BASE_URL}/users/profile"

#####################################
# COUNTRY CHANGE BLOCK (OWNER WITH SHOWROOMS)
#####################################
print_section "Country change blocked"
request "POST /showrooms/draft" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

request "PATCH /users/profile (country change blocked)" 409 "USER_COUNTRY_CHANGE_BLOCKED" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"Poland"}' \
  "${BASE_URL}/users/profile"

request "PATCH /users/profile (blocked country)" 403 "COUNTRY_BLOCKED" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"country":"russia"}' \
  "${BASE_URL}/users/profile"

print_section "RESULT"
echo "✔ User profile tests passed"
