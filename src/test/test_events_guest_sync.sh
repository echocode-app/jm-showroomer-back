#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq node
require_env TEST_USER_TOKEN

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
guard_prod_write "${BASE_URL}"
warn_if_prod_write "${BASE_URL}"

AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")
NOW=$(now_ns)
PREFIX="events_guest_sync_${NOW}"

print_section "Seed events for guest sync"
SEED_RAW=$(NODE_ENV="${NODE_ENV:-dev}" node scripts/seed_test_events.js "$PREFIX")
SEED_JSON=$(echo "$SEED_RAW" | tail -n 1)
echo "$SEED_RAW"
echo "$SEED_JSON" | jq -e . >/dev/null || fail "Seed script did not return valid JSON payload"

FUTURE_ID=$(echo "$SEED_JSON" | jq -r '.futureId')
FUTURE_ID2=$(echo "$SEED_JSON" | jq -r '.futureId2')
PAST_ID=$(echo "$SEED_JSON" | jq -r '.pastId')
HIDDEN_ID=$(echo "$SEED_JSON" | jq -r '.hiddenId')
BLOCKED_ID=$(echo "$SEED_JSON" | jq -r '.blockedId')
MISSING_ID="${PREFIX}_missing_1"

assert_non_empty "$FUTURE_ID" "futureId"
assert_non_empty "$FUTURE_ID2" "futureId2"
assert_non_empty "$PAST_ID" "pastId"
assert_non_empty "$HIDDEN_ID" "hiddenId"
assert_non_empty "$BLOCKED_ID" "blockedId"

print_section "1) Sync want list for auth user"
PAYLOAD=$(jq -nc --arg id "$FUTURE_ID" '{wantToVisitIds: [$id], dismissedIds: []}')
http_request "POST /collections/want-to-visit/events/sync (want)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"

HAS_WANT=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.applied.wantToVisit[]? | select(. == $id)')
assert_non_empty "$HAS_WANT" "sync applied want futureId"

http_request "GET /collections/want-to-visit/events after sync" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/want-to-visit/events?limit=100"
HAS_IN_COLLECTION=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.items[]?.id | select(. == $id)')
assert_non_empty "$HAS_IN_COLLECTION" "want-to-visit collection contains futureId"

print_section "2) Dismiss overrides want"
PAYLOAD=$(jq -nc --arg want "$FUTURE_ID2" --arg dismiss1 "$FUTURE_ID2" --arg dismiss2 "$FUTURE_ID" \
  '{wantToVisitIds: [$want], dismissedIds: [$dismiss1, $dismiss2]}')
http_request "POST /collections/want-to-visit/events/sync (dismiss overrides)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"

HAS_WANT2=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID2" '.data.applied.wantToVisit[]? | select(. == $id)')
HAS_DISMISSED=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.applied.dismissed[]? | select(. == $id)')
assert_non_empty "$HAS_WANT2" "futureId2 applied to want"
assert_non_empty "$HAS_DISMISSED" "futureId applied to dismissed"

http_request "GET /collections/want-to-visit/events after dismiss merge" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/want-to-visit/events?limit=100"
HAS_FUTURE2_IN_COLLECTION=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID2" '.data.items[]?.id | select(. == $id)')
HAS_FUTURE1_IN_COLLECTION=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.items[]?.id | select(. == $id)')
assert_non_empty "$HAS_FUTURE2_IN_COLLECTION" "futureId2 remains in want collection"
if [[ -n "$HAS_FUTURE1_IN_COLLECTION" ]]; then
  fail "dismissed futureId must not be in want collection"
fi

print_section "3) Invalid/unpublished IDs are skipped"
PAYLOAD=$(jq -nc --arg missing "$MISSING_ID" --arg hidden "$HIDDEN_ID" \
  '{wantToVisitIds: [$missing], dismissedIds: [$hidden]}')
http_request "POST /collections/want-to-visit/events/sync (invalid ids)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"

HAS_MISSING_SKIPPED=$(echo "$LAST_BODY" | jq -r --arg id "$MISSING_ID" '.data.skipped[]? | select(. == $id)')
HAS_HIDDEN_SKIPPED=$(echo "$LAST_BODY" | jq -r --arg id "$HIDDEN_ID" '.data.skipped[]? | select(. == $id)')
assert_non_empty "$HAS_MISSING_SKIPPED" "missing id is skipped"
assert_non_empty "$HAS_HIDDEN_SKIPPED" "unpublished id is skipped"

print_section "4) Past events are skipped"
PAYLOAD=$(jq -nc --arg id "$PAST_ID" '{wantToVisitIds: [$id], dismissedIds: []}')
http_request "POST /collections/want-to-visit/events/sync (past skipped)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"

HAS_PAST_SKIPPED=$(echo "$LAST_BODY" | jq -r --arg id "$PAST_ID" '.data.skipped[]? | select(. == $id)')
assert_non_empty "$HAS_PAST_SKIPPED" "past id is skipped"

print_section "5) Batch size > 100 is rejected"
TOO_MANY_IDS=$(jq -nc '[range(0;101) | "bulk_\(.)"]')
PAYLOAD=$(jq -nc --argjson ids "$TOO_MANY_IDS" '{wantToVisitIds: $ids, dismissedIds: []}')
http_request "POST /collections/want-to-visit/events/sync (>100)" 400 "EVENT_SYNC_LIMIT_EXCEEDED" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"

print_section "6) Idempotent second sync call"
PAYLOAD=$(jq -nc --arg want "$FUTURE_ID2" --arg dismiss "$FUTURE_ID" \
  '{wantToVisitIds: [$want], dismissedIds: [$dismiss]}')
http_request "POST /collections/want-to-visit/events/sync (first idempotent payload)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"
FIRST_BODY="$LAST_BODY"

http_request "POST /collections/want-to-visit/events/sync (second idempotent payload)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"
SECOND_BODY="$LAST_BODY"

FIRST_APPLIED=$(echo "$FIRST_BODY" | jq -c '.data.applied')
SECOND_APPLIED=$(echo "$SECOND_BODY" | jq -c '.data.applied')
assert_eq "$SECOND_APPLIED" "$FIRST_APPLIED" "idempotent applied payload"

print_section "7) Blocked country excluded"
PAYLOAD=$(jq -nc --arg id "$BLOCKED_ID" '{wantToVisitIds: [$id], dismissedIds: []}')
http_request "POST /collections/want-to-visit/events/sync (blocked skipped)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "$PAYLOAD" \
  "${BASE_URL}/collections/want-to-visit/events/sync"

HAS_BLOCKED_SKIPPED=$(echo "$LAST_BODY" | jq -r --arg id "$BLOCKED_ID" '.data.skipped[]? | select(. == $id)')
assert_non_empty "$HAS_BLOCKED_SKIPPED" "blocked id is skipped"

http_request "GET /collections/want-to-visit/events final state" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/want-to-visit/events?limit=100"
HAS_BLOCKED_IN_COLLECTION=$(echo "$LAST_BODY" | jq -r --arg id "$BLOCKED_ID" '.data.items[]?.id | select(. == $id)')
if [[ -n "$HAS_BLOCKED_IN_COLLECTION" ]]; then
  fail "blocked event must not appear in want-to-visit collection"
fi

print_section "RESULT"
echo "✔ Events guest sync tests passed"
