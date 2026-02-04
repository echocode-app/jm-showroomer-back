#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq
require_env BASE_URL

ENV="${NODE_ENV:-dev}"
BASE_URL="${BASE_URL}"
preflight_server "${BASE_URL}"

print_section "Smoke (public)"
http_request "GET /health" 200 "" "${BASE_URL}/health"
http_request "GET /showrooms" 200 "" "${BASE_URL}/showrooms"
http_request "GET /lookbooks" 200 "" "${BASE_URL}/lookbooks"

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

  print_section "Country restrictions"
  http_request "POST /users/complete-onboarding (UA)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" -H "$(json_header)" \
    -d '{"country":"Ukraine"}' \
    "${BASE_URL}/users/complete-onboarding"

  http_request "POST /users/complete-onboarding (RU blocked)" 403 "COUNTRY_BLOCKED" \
    -X POST "${AUTH_HEADER[@]}" -H "$(json_header)" \
    -d '{"country":"Russia"}' \
    "${BASE_URL}/users/complete-onboarding"
else
  echo "⚠ TEST_USER_TOKEN not set; skipping authenticated smoke checks"
fi

print_section "RESULT"
echo "✔ Smoke tests passed"
