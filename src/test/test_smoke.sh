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

print_section "Smoke (public)"
http_request "GET /health" 200 "" "${BASE_URL}/health"
http_request "GET /showrooms" 200 "" "${BASE_URL}/showrooms"

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
