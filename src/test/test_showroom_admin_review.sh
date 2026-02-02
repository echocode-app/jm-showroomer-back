#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running Showroom Admin Review tests with NODE_ENV=$ENV"

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

if [ -z "${TEST_ADMIN_TOKEN:-}" ]; then
  echo "❌ TEST_ADMIN_TOKEN is required"
  exit 1
fi

BASE_URL="${BASE_URL:?BASE_URL is required}"
AUTH_HEADER=(-H "Authorization: Bearer ${TEST_USER_TOKEN}")
ADMIN_HEADER=(-H "Authorization: Bearer ${TEST_ADMIN_TOKEN}")
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

  local attempts=0
  local delay=1
  while true; do
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$@")
    STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

    if [[ "$STATUS" == "429" ]]; then
      CODE=$(echo "$BODY" | jq -r '.error.code // empty')
      if [[ "$CODE" == "RATE_LIMIT_EXCEEDED" && "$attempts" -lt 5 ]]; then
        attempts=$((attempts + 1))
        sleep "$delay"
        delay=$((delay * 2))
        continue
      fi
    fi
    break
  done

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

#####################################
# FLOW
#####################################
print_section "Owner submit -> pending snapshot"
request "POST /showrooms/draft" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_ID" "showroom id"

NAME_MAIN="Admin Review Showroom ${NOW}"
request "PATCH /showrooms/{id} (complete data)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_MAIN}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"Main St 2\",\"city\":\"Kyiv\",\"availability\":\"open\",\"contacts\":{\"phone\":\"+380501112244\",\"instagram\":\"https://instagram.com/review${NOW}\"},\"location\":{\"lat\":50.45,\"lng\":30.52}}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

request "POST /showrooms/{id}/submit" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}/submit"

PENDING_SNAPSHOT=$(echo "$BODY" | jq -r '.data.showroom.pendingSnapshot // empty')
if [[ -z "$PENDING_SNAPSHOT" || "$PENDING_SNAPSHOT" == "null" ]]; then
  fail "pendingSnapshot missing after submit"
fi

request "GET /showrooms/{id} (after submit)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

LAST_ACTION=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].action // empty')
LAST_STATUS_BEFORE=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusBefore // empty')
LAST_STATUS_AFTER=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusAfter // empty')
CHANGED_HAS_STATUS=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].changedFields | index("status")')

assert_eq "$LAST_ACTION" "submit" "last action"
assert_eq "$LAST_STATUS_BEFORE" "draft" "statusBefore"
assert_eq "$LAST_STATUS_AFTER" "pending" "statusAfter"
if [[ "$CHANGED_HAS_STATUS" == "null" ]]; then
  fail "editHistory.changedFields missing status"
fi

print_section "Admin reject"
request "POST /admin/showrooms/{id}/reject" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"reason":"Missing details"}' \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/reject"

STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$STATUS" "rejected" "status"
PENDING_SNAPSHOT=$(echo "$BODY" | jq -r '.data.showroom.pendingSnapshot // empty')
if [[ "$PENDING_SNAPSHOT" != "null" && -n "$PENDING_SNAPSHOT" ]]; then
  fail "pendingSnapshot should be cleared on reject"
fi

LAST_ACTION=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].action // empty')
LAST_STATUS_BEFORE=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusBefore // empty')
LAST_STATUS_AFTER=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusAfter // empty')
assert_eq "$LAST_ACTION" "reject" "last action"
assert_eq "$LAST_STATUS_BEFORE" "pending" "statusBefore"
assert_eq "$LAST_STATUS_AFTER" "rejected" "statusAfter"

print_section "Owner submit again -> admin approve"
UPDATED_NAME="Admin Review Updated ${NOW}"
request "PATCH rejected (update name)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${UPDATED_NAME}\"}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

request "POST /showrooms/{id}/submit (again)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}/submit"

request "POST /admin/showrooms/{id}/approve" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/approve"

STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$STATUS" "approved" "status"
PENDING_SNAPSHOT=$(echo "$BODY" | jq -r '.data.showroom.pendingSnapshot // empty')
if [[ "$PENDING_SNAPSHOT" != "null" && -n "$PENDING_SNAPSHOT" ]]; then
  fail "pendingSnapshot should be cleared on approve"
fi

NAME_CURRENT=$(echo "$BODY" | jq -r '.data.showroom.name // empty')
assert_eq "$NAME_CURRENT" "$UPDATED_NAME" "approved name"

LAST_ACTION=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].action // empty')
LAST_STATUS_BEFORE=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusBefore // empty')
LAST_STATUS_AFTER=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusAfter // empty')

assert_eq "$LAST_ACTION" "approve" "last action"
assert_eq "$LAST_STATUS_BEFORE" "pending" "statusBefore"
assert_eq "$LAST_STATUS_AFTER" "approved" "statusAfter"

echo "✅ Showroom admin review tests passed"
