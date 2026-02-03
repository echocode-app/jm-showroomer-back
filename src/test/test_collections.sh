#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running Collections tests with NODE_ENV=$ENV"

ENV_FILE=".env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found"
  exit 1
fi

export $(grep -v '^#' "$ENV_FILE" | grep -v FIREBASE_PRIVATE_KEY | xargs)

BASE_URL="${BASE_URL:?BASE_URL is required}"

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
  shift 2 || true

  echo
  echo "▶ $label"

  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$@")
  STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
  BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  echo "$BODY"

  if [[ "$STATUS" != "$expected_status" ]]; then
    fail "Expected HTTP $expected_status, got $STATUS"
  fi

  echo "✔ HTTP $STATUS"
}

#####################################
# PUBLIC COLLECTIONS (NO AUTH)
#####################################
print_section "Public collections"
request "GET /collections/favorites/showrooms" 200 \
  "${BASE_URL}/collections/favorites/showrooms"
request "GET /collections/favorites/lookbooks" 200 \
  "${BASE_URL}/collections/favorites/lookbooks"
request "GET /collections/want-to-visit/events" 200 \
  "${BASE_URL}/collections/want-to-visit/events"

print_section "RESULT"
echo "✔ Collections tests passed"
