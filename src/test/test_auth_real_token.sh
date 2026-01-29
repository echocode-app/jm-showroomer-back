#!/usr/bin/env bash
set -euo pipefail

#####################################
# CONFIG
#####################################

DEV_BASE_URL="http://localhost:3005/api/v1"
PROD_BASE_URL="https://jm-showroomer-back.onrender.com/api/v1"

# ID Token OWNER
OWNER_TOKEN="YOUR_REAL_OWNER_ID_TOKEN"
ADMIN_TOKEN="YOUR_REAL_ADMIN_ID_TOKEN"
USER_TOKEN="YOUR_REAL_USER_ID_TOKEN"

AUTH_HEADER_OWNER=(-H "Authorization: Bearer ${OWNER_TOKEN}")
AUTH_HEADER_ADMIN=(-H "Authorization: Bearer ${ADMIN_TOKEN}")
AUTH_HEADER_USER=(-H "Authorization: Bearer ${USER_TOKEN}")
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
# TESTS
#####################################

print_section "LOCAL DEV — Auth & User Info (real tokens)"

# Health check
request "Health check" 200 "${DEV_BASE_URL}/health"

# Public endpoints
request "Public lookbooks" 200 "${DEV_BASE_URL}/lookbooks"
request "Public showrooms" 200 "${DEV_BASE_URL}/showrooms"

# GET user info OWNER
request "GET /users/me OWNER" 200 "${AUTH_HEADER_OWNER[@]}" "${DEV_BASE_URL}/users/me"

# GET user info ADMIN
request "GET /users/me ADMIN" 200 "${AUTH_HEADER_ADMIN[@]}" "${DEV_BASE_URL}/users/me"

# GET user info USER
request "GET /users/me USER" 200 "${AUTH_HEADER_USER[@]}" "${DEV_BASE_URL}/users/me"

# Complete onboarding (if needed)
request "POST /users/complete-onboarding OWNER" 200 -X POST "${AUTH_HEADER_OWNER[@]}" "${DEV_BASE_URL}/users/complete-onboarding"

echo
echo "✔ Auth real-token tests completed"
