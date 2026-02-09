#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq

ENV="${NODE_ENV:-dev}"
BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"

print_section "Smoke (public)"
http_request "GET /health" 200 "" "${BASE_URL}/health"
http_request "GET /showrooms" 200 "" "${BASE_URL}/showrooms"
request_allow_status_or_index_not_ready "GET /showrooms?city=Kyiv" \
  "${BASE_URL}/showrooms?city=Kyiv"
request_allow_status_or_index_not_ready "GET /showrooms?city=Cherkasy" \
  "${BASE_URL}/showrooms?city=Cherkasy"
request_allow_status_or_index_not_ready "GET /showrooms?city=Zaporizhzhia" \
  "${BASE_URL}/showrooms?city=Zaporizhzhia"
http_request "GET /lookbooks" 200 "" "${BASE_URL}/lookbooks"

print_section "Public list validation (query errors)"
http_request "GET /showrooms?limit=0 (invalid)" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms?limit=0"
http_request "GET /showrooms?limit=101 (invalid)" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms?limit=101"
http_request "GET /showrooms?fields=bad (invalid)" 400 "QUERY_INVALID" \
  "${BASE_URL}/showrooms?fields=bad"
http_request "GET /showrooms?cursor=invalid (invalid)" 400 "CURSOR_INVALID" \
  "${BASE_URL}/showrooms?cursor=invalid"
http_request "GET /showrooms?geohashPrefixes=a,b&cursor=xxxx (invalid combo)" 400 "CURSOR_INVALID" \
  "${BASE_URL}/showrooms?geohashPrefixes=a,b&cursor=xxxx"

LOOKBOOK_COUNT=$(json_get "$LAST_BODY" '.data.lookbooks // [] | length')
if [[ "$LOOKBOOK_COUNT" != "0" ]]; then
  HAS_UNPUBLISHED=$(json_get "$LAST_BODY" '.data.lookbooks // [] | map(select(.published == false)) | length')
  if [[ "$HAS_UNPUBLISHED" != "0" ]]; then
    fail "Unpublished lookbook leaked to public list"
  fi

  COVER_URL=$(json_get "$LAST_BODY" '.data.lookbooks[0].coverUrl // empty')
  COVER_PATH=$(json_get "$LAST_BODY" '.data.lookbooks[0].coverPath // empty')
  assert_non_empty "$COVER_PATH" "coverPath"
  assert_non_empty "$COVER_URL" "coverUrl"
  if [[ "$COVER_URL" != http* ]]; then
    fail "coverUrl is not a URL"
  fi
else
  echo "⚠ No lookbooks returned (seed not run)"
fi

print_section "Collections stubs (public)"
http_request "GET /collections/favorites/showrooms" 200 "" \
  "${BASE_URL}/collections/favorites/showrooms"
http_request "GET /collections/favorites/lookbooks" 200 "" \
  "${BASE_URL}/collections/favorites/lookbooks"
http_request "GET /collections/want-to-visit/events" 200 "" \
  "${BASE_URL}/collections/want-to-visit/events"

print_section "Auth negative"
http_request "GET /users/me (unauth)" 401 "AUTH_MISSING" "${BASE_URL}/users/me"
http_request "POST /users/complete-onboarding (unauth)" 401 "AUTH_MISSING" \
  -X POST -H "$(json_header)" \
  -d '{"country":"Ukraine"}' \
  "${BASE_URL}/users/complete-onboarding"
http_request "POST /auth/oauth (missing idToken)" 400 "ID_TOKEN_REQUIRED" \
  -X POST -H "$(json_header)" \
  -d '{}' \
  "${BASE_URL}/auth/oauth"
http_request "POST /auth/oauth (invalid idToken)" 401 "AUTH_INVALID" \
  -X POST -H "$(json_header)" \
  -d '{"idToken":"invalid"}' \
  "${BASE_URL}/auth/oauth"
http_request "POST /events/{id}/rsvp (unauth)" 401 "AUTH_MISSING" \
  -X POST \
  "${BASE_URL}/events/event-test-1/rsvp"
http_request "POST /lookbooks/{id}/rsvp (unauth)" 401 "AUTH_MISSING" \
  -X POST \
  "${BASE_URL}/lookbooks/event-test-1/rsvp"

if [[ -n "${TEST_USER_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")

  print_section "Auth contract (with token)"
  ME_RESPONSE=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  echo "$ME_RESPONSE"
  USER_ROLE=$(json_get "$ME_RESPONSE" '.data.role // empty')
  ONBOARDING_STATE=$(json_get "$ME_RESPONSE" '.data.onboardingState // empty')
  assert_non_empty "$USER_ROLE" "role"
  assert_non_empty "$ONBOARDING_STATE" "onboardingState"
  echo "✔ role=$USER_ROLE onboardingState=$ONBOARDING_STATE"

  print_section "RBAC (lookbooks create)"
  if [[ "$USER_ROLE" == "user" ]]; then
    http_request "USER → POST /lookbooks/create" 403 "FORBIDDEN" \
      -X POST "${AUTH_HEADER[@]}" -H "$(json_header)" \
      -d '{"name":"Test"}' \
      "${BASE_URL}/lookbooks/create"
  else
    http_request "OWNER → POST /lookbooks/create" 200 "" \
      -X POST "${AUTH_HEADER[@]}" -H "$(json_header)" \
      -d '{"name":"Test"}' \
      "${BASE_URL}/lookbooks/create"
  fi

  print_section "Events RSVP (stub)"
  http_request "POST /events/{id}/rsvp" 200 "" \
    -X POST "${AUTH_HEADER[@]}" \
    "${BASE_URL}/events/event-test-1/rsvp"

  print_section "Lookbooks RSVP (stub)"
  http_request "POST /lookbooks/{id}/rsvp" 200 "" \
    -X POST "${AUTH_HEADER[@]}" \
    "${BASE_URL}/lookbooks/event-test-1/rsvp"

  print_section "Country restrictions"
  http_request "POST /users/complete-onboarding (UA)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" -H "$(json_header)" \
    -d '{"country":"Ukraine"}' \
    "${BASE_URL}/users/complete-onboarding"

  http_request "POST /users/complete-onboarding (RU blocked)" 403 "COUNTRY_BLOCKED" \
    -X POST "${AUTH_HEADER[@]}" -H "$(json_header)" \
    -d '{"country":"Russia"}' \
    "${BASE_URL}/users/complete-onboarding"

  print_section "Seeded lookbooks do not block country change"
  ME_CHECK=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  CURRENT_COUNTRY=$(json_get "$ME_CHECK" '.data.country // empty')
  TARGET_COUNTRY="Poland"
  if [[ "$CURRENT_COUNTRY" == "Poland" ]]; then
    TARGET_COUNTRY="Ukraine"
  fi

  LOOKBOOKS_RESPONSE=$(curl -s "${BASE_URL}/lookbooks?limit=1")
  HAS_LOOKBOOKS=$(json_get "$LOOKBOOKS_RESPONSE" '.data.lookbooks // [] | length')
  if [[ "$HAS_LOOKBOOKS" == "0" ]]; then
    echo "⚠ No lookbooks returned (seed not run); skipping country change check"
  else
    COUNTRY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
      -X PATCH "${AUTH_HEADER[@]}" -H "$(json_header)" \
      -d "{\"country\":\"${TARGET_COUNTRY}\"}" \
      "${BASE_URL}/users/profile")
    COUNTRY_STATUS=$(echo "$COUNTRY_RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
    COUNTRY_BODY=$(echo "$COUNTRY_RESPONSE" | sed '/HTTP_STATUS/d')
    echo "$COUNTRY_BODY"
    if [[ "$COUNTRY_STATUS" == "409" ]]; then
      CODE=$(echo "$COUNTRY_BODY" | jq -r '.error.code // empty')
      assert_eq "$CODE" "USER_COUNTRY_CHANGE_BLOCKED" "error.code"
      echo "⚠ Country change blocked (user likely has owned assets)."
    elif [[ "$COUNTRY_STATUS" != "200" ]]; then
      fail "Expected HTTP 200 or 409, got $COUNTRY_STATUS"
    else
      # revert to original country if changed
      if [[ -n "$CURRENT_COUNTRY" && "$CURRENT_COUNTRY" != "$TARGET_COUNTRY" ]]; then
        curl -s -X PATCH "${AUTH_HEADER[@]}" -H "$(json_header)" \
          -d "{\"country\":\"${CURRENT_COUNTRY}\"}" \
          "${BASE_URL}/users/profile" >/dev/null
      fi
    fi
  fi
else
  echo "⚠ TEST_USER_TOKEN not set; skipping authenticated smoke checks"
fi

print_section "RESULT"
echo "✔ Smoke tests passed"
