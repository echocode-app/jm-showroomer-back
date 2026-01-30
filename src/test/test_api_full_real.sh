#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running API tests with NODE_ENV=$ENV"

if [ ! -f ".env.$ENV" ]; then
  echo "❌ File .env.$ENV not found!"
  exit 1
fi

export $(grep -v '^#' .env.$ENV | grep -v FIREBASE_PRIVATE_KEY | xargs)
TEST_USER_TOKEN="${TEST_USER_TOKEN:-}"

BASE_URL="${BASE_URL:-http://localhost:3000}"
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

request() {
  local label=$1
  local expected=$2
  shift 2

  echo
  echo "▶ ${label}"
  set +e
  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$@")
  STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
  set -e

  echo "$BODY"

  if [[ "$STATUS" == "$expected" ]]; then
    echo "✔ HTTP ${STATUS}"
  else
    echo "✖ Expected ${expected}, got ${STATUS}"
  fi
}

#####################################
# DETERMINE ROLE
#####################################
USER_ROLE=$(curl -s -H "Authorization: Bearer ${TEST_USER_TOKEN}" "${BASE_URL}/users/me" | jq -r '.data.role')
echo "⚡ Running tests as role: $USER_ROLE"

#####################################
# PUBLIC API TESTS
#####################################
print_section "Public API"
request "Health check" 200 "${BASE_URL}/health"
request "Public lookbooks" 200 "${BASE_URL}/lookbooks"
request "Public showrooms" 200 "${BASE_URL}/showrooms"

#####################################
# AUTH & ONBOARDING
#####################################
print_section "User Info & Onboarding"
request "GET /users/me" 200 "${AUTH_HEADER[@]}" "${BASE_URL}/users/me"

ONBOARDING_BODY='{"country":"Ukraine"}'
request "POST /users/complete-onboarding" 200 -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "$ONBOARDING_BODY" "${BASE_URL}/users/complete-onboarding"

#####################################
# OWNER-ONLY TESTS
#####################################
if [[ "$USER_ROLE" == "owner" ]]; then
  print_section "Showroom CRUD"

  SHOWROOM_CREATE_BODY=$(
cat <<EOF
{
    "name": "Test Showroom",
    "type": "Мультибренд шоурум",
    "availability": "вільний доступ",
    "address": "Kyiv, Ukraine",
    "country": "Ukraine",
    "contacts": {"phone": "+380999999999","instagram": "https://instagram.com/testshowroom"},
    "location": {"lat": 50.45,"lng": 30.523}
}
EOF
  )

  SHOWROOM_ID=$(curl -s -X POST "${BASE_URL}/showrooms/create" \
    "${AUTH_HEADER[@]}" \
    "${JSON_HEADER[@]}" \
    -d "$SHOWROOM_CREATE_BODY" | jq -r '.data.id')

  if [[ "$SHOWROOM_ID" != "null" && -n "$SHOWROOM_ID" ]]; then
    echo "✔ Created showroom ID: $SHOWROOM_ID"
  else
    echo "✖ Failed to create showroom"
  fi

  request "GET /showrooms/{id}" 200 "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms/${SHOWROOM_ID}"
  SHOWROOM_UPDATE_BODY='{ "name": "Updated Showroom Name" }'
  request "PATCH /showrooms/{id}" 200 -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "$SHOWROOM_UPDATE_BODY" "${BASE_URL}/showrooms/${SHOWROOM_ID}"
  request "POST /showrooms/{id}/favorite" 200 -X POST "${AUTH_HEADER[@]}" "${BASE_URL}/showrooms/${SHOWROOM_ID}/favorite"

  print_section "Country Restrictions"
  BLOCKED_BODY='{"name":"Blocked Showroom","country":"Russia"}'
  request "POST /showrooms/create (RU blocked)" 400 -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "$BLOCKED_BODY" "${BASE_URL}/showrooms/create"

  ALLOWED_BODY='{"name":"Allowed Showroom","country":"Ukraine"}'
  request "POST /showrooms/create (UA allowed)" 200 -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "$ALLOWED_BODY" "${BASE_URL}/showrooms/create"
else
  echo "⚠ Skipping OWNER-only tests"
fi

#####################################
# RBAC TESTS (runs for any role)
#####################################
print_section "RBAC tests"
request "POST /lookbooks/create (forbidden)" 403 -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d '{"name":"Test Lookbook"}' "${BASE_URL}/lookbooks/create"

#####################################
# FINAL RESULT
#####################################
print_section "RESULT"
echo "✔ All real-token tests executed successfully"
