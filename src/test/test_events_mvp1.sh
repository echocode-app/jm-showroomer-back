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
PREFIX="events_mvp1_${NOW}"

print_section "Seed test events"
SEED_RAW=$(NODE_ENV="${NODE_ENV:-dev}" node scripts/seed_test_events.js "$PREFIX")
SEED_JSON=$(echo "$SEED_RAW" | tail -n 1)
echo "$SEED_RAW"
echo "$SEED_JSON" | jq -e . >/dev/null || fail "Seed script did not return valid JSON payload"

FUTURE_ID=$(echo "$SEED_JSON" | jq -r '.futureId')
FUTURE_ID2=$(echo "$SEED_JSON" | jq -r '.futureId2')
PAST_ID=$(echo "$SEED_JSON" | jq -r '.pastId')
HIDDEN_ID=$(echo "$SEED_JSON" | jq -r '.hiddenId')

assert_non_empty "$FUTURE_ID" "futureId"
assert_non_empty "$PAST_ID" "pastId"
assert_non_empty "$HIDDEN_ID" "hiddenId"

print_section "Public list excludes past and unpublished"
http_request "GET /events (public)" 200 "" \
  "${BASE_URL}/events?limit=50"

HAS_FUTURE=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.events[]?.id | select(. == $id)')
HAS_FUTURE2=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID2" '.data.events[]?.id | select(. == $id)')
HAS_PAST=$(echo "$LAST_BODY" | jq -r --arg id "$PAST_ID" '.data.events[]?.id | select(. == $id)')
HAS_HIDDEN=$(echo "$LAST_BODY" | jq -r --arg id "$HIDDEN_ID" '.data.events[]?.id | select(. == $id)')

assert_non_empty "$HAS_FUTURE" "future event in public list"
assert_non_empty "$HAS_FUTURE2" "future2 event in public list"
if [[ -n "$HAS_PAST" ]]; then
  fail "Past event should not appear in /events list"
fi
if [[ -n "$HAS_HIDDEN" ]]; then
  fail "Unpublished event should not appear in /events list"
fi

print_section "Get event by id"
http_request "GET /events/{futureId}" 200 "" \
  "${BASE_URL}/events/${FUTURE_ID}"

http_request "GET /events/{pastId} (direct link allowed)" 200 "" \
  "${BASE_URL}/events/${PAST_ID}"

http_request "GET /events/{hiddenId} unpublished" 404 "EVENT_NOT_FOUND" \
  "${BASE_URL}/events/${HIDDEN_ID}"

http_request "GET /events/{missing}" 404 "EVENT_NOT_FOUND" \
  "${BASE_URL}/events/${PREFIX}_missing"

print_section "Want-to-visit auth and idempotency"
http_request "GET /collections/want-to-visit/events without auth (guest empty)" 200 "" \
  "${BASE_URL}/collections/want-to-visit/events"

http_request "POST /events/{id}/want-to-visit" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/want-to-visit"

http_request "POST /events/{id}/want-to-visit idempotent" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/want-to-visit"

http_request "GET /collections/want-to-visit/events" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/want-to-visit/events"

HAS_WANT=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.items[]?.id | select(. == $id)')
assert_non_empty "$HAS_WANT" "want-to-visit contains futureId"

print_section "Dismiss flow"
http_request "POST /events/{id}/dismiss" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/dismiss"

http_request "POST /events/{id}/dismiss idempotent" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/dismiss"

http_request "GET /collections/want-to-visit/events after dismiss" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/collections/want-to-visit/events"

HAS_WANT_AFTER_DISMISS=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.items[]?.id | select(. == $id)')
if [[ -n "$HAS_WANT_AFTER_DISMISS" ]]; then
  fail "Dismissed event must be removed from want-to-visit list"
fi

http_request "GET /events (auth excludes dismissed)" 200 "" \
  "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events?limit=50"

HAS_DISMISSED_IN_AUTH_LIST=$(echo "$LAST_BODY" | jq -r --arg id "$FUTURE_ID" '.data.events[]?.id | select(. == $id)')
if [[ -n "$HAS_DISMISSED_IN_AUTH_LIST" ]]; then
  fail "Dismissed event should be hidden from authed /events list"
fi

print_section "Undismiss and remove want-to-visit idempotency"
http_request "DELETE /events/{id}/dismiss" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/dismiss"

http_request "DELETE /events/{id}/dismiss idempotent" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/dismiss"

http_request "POST /events/{id}/want-to-visit (again)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/want-to-visit"

http_request "DELETE /events/{id}/want-to-visit" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/want-to-visit"

http_request "DELETE /events/{id}/want-to-visit idempotent" 200 "" \
  -X DELETE "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${FUTURE_ID}/want-to-visit"

print_section "404 and MVP2-only write endpoint"
http_request "POST /events/{missing}/want-to-visit" 404 "EVENT_NOT_FOUND" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/events/${PREFIX}_missing/want-to-visit"

http_request "POST /events/{id}/rsvp MVP2 only" 501 "EVENTS_WRITE_MVP2_ONLY" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d '{}' \
  "${BASE_URL}/events/${FUTURE_ID}/rsvp"

print_section "RESULT"
echo "✔ Events MVP1 tests passed"
