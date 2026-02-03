#!/usr/bin/env bash
set -euo pipefail

#####################################
# ENVIRONMENT
#####################################
ENV="${NODE_ENV:-dev}"
echo "⚡ Running Showroom Edit/Delete tests with NODE_ENV=$ENV"

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
# OWNER FLOW
#####################################
print_section "Owner draft -> pending"
request "POST /showrooms/draft" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

SHOWROOM_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$SHOWROOM_ID" "showroom id"

NAME_MAIN="Edit Delete Showroom ${NOW}"
request "PATCH /showrooms/{id} (complete data)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"${NAME_MAIN}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"Main St 1\",\"city\":\"Kyiv\",\"availability\":\"open\",\"contacts\":{\"phone\":\"+380501112233\",\"instagram\":\"https://instagram.com/showroom${NOW}\"},\"location\":{\"lat\":50.45,\"lng\":30.52}}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

request "GET /showrooms/{id} (after patch)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

LAST_ACTION=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].action // empty')
LAST_STATUS_BEFORE=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusBefore // empty')
LAST_STATUS_AFTER=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].statusAfter // empty')
CHANGED_HAS_NAME=$(echo "$BODY" | jq -r '.data.showroom.editHistory[-1].changedFields | index("name")')

assert_eq "$LAST_ACTION" "patch" "last action"
assert_eq "$LAST_STATUS_BEFORE" "draft" "statusBefore"
assert_eq "$LAST_STATUS_AFTER" "draft" "statusAfter"
if [[ "$CHANGED_HAS_NAME" == "null" ]]; then
  fail "editHistory.changedFields missing name"
fi

request "POST /showrooms/{id}/submit" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}/submit"

STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$STATUS" "pending" "status"

request "GET /showrooms/{id} (pending snapshot)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

PENDING_SNAPSHOT=$(echo "$BODY" | jq -c '.data.showroom.pendingSnapshot // empty')
if [[ -z "$PENDING_SNAPSHOT" || "$PENDING_SNAPSHOT" == "null" ]]; then
  fail "pendingSnapshot missing after submit"
fi
SNAPSHOT_HASH=$(echo "$PENDING_SNAPSHOT" | shasum -a 256 | awk '{print $1}')

print_section "Pending lock"
request "PATCH pending (locked)" 409 "SHOWROOM_LOCKED_PENDING" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Should Fail"}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

request "DELETE pending (locked)" 409 "SHOWROOM_LOCKED_PENDING" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

request "GET /showrooms/{id} (snapshot unchanged)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

SNAPSHOT_HASH_AFTER=$(echo "$BODY" | jq -c '.data.showroom.pendingSnapshot // empty' | shasum -a 256 | awk '{print $1}')
assert_eq "$SNAPSHOT_HASH_AFTER" "$SNAPSHOT_HASH" "pendingSnapshot hash"

print_section "Admin reject -> owner edit"
request "POST /admin/showrooms/{id}/reject" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"reason":"Needs changes"}' \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/reject"

STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$STATUS" "rejected" "status"

request "PATCH rejected (allowed)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Edit After Reject"}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

request "POST /showrooms/{id}/submit (again)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}/submit"

print_section "Admin approve -> owner delete"
request "POST /admin/showrooms/{id}/approve" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/admin/showrooms/${SHOWROOM_ID}/approve"

STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$STATUS" "approved" "status"

request "PATCH approved (allowed)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{"name":"Approved Edit"}' \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

request "DELETE approved (owner)" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${SHOWROOM_ID}"

STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$STATUS" "deleted" "status"

print_section "Deleted hidden from public list"
LIST=$(curl -s "${BASE_URL}/showrooms")
FOUND=$(echo "$LIST" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[]?.id | select(. == $id)')
if [[ -n "$FOUND" ]]; then
  fail "Deleted showroom appears in public list"
fi

print_section "Admin delete allowed in any status"
request "POST /showrooms/draft (admin delete target)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/draft"

ADMIN_DEL_ID=$(echo "$BODY" | jq -r '.data.showroom.id // empty')
assert_non_empty "$ADMIN_DEL_ID" "admin delete showroom id"

request "PATCH /showrooms/{id} (admin delete target)" 200 "" \
  -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"name\":\"Admin Delete ${NOW}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"Main St 3\",\"city\":\"Kyiv\",\"availability\":\"open\",\"contacts\":{\"phone\":\"+380501112255\",\"instagram\":\"https://instagram.com/admindelete${NOW}\"},\"location\":{\"lat\":50.45,\"lng\":30.52}}" \
  "${BASE_URL}/showrooms/${ADMIN_DEL_ID}"

request "POST /showrooms/{id}/submit (admin delete target)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/showrooms/${ADMIN_DEL_ID}/submit"

request "DELETE /admin/showrooms/{id} (pending)" 200 "" \
  -X DELETE "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/admin/showrooms/${ADMIN_DEL_ID}"

ADMIN_DEL_STATUS=$(echo "$BODY" | jq -r '.data.showroom.status // empty')
assert_eq "$ADMIN_DEL_STATUS" "deleted" "admin deleted status"

echo "✅ Showroom edit/delete tests passed"
