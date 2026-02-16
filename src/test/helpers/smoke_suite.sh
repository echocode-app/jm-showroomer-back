#!/usr/bin/env bash

run_public_smoke_suite() {
  print_section "Smoke (public)"
  http_request "GET /health" 200 "" "${BASE_URL}/health"
  http_request "GET /showrooms" 200 "" "${BASE_URL}/showrooms"
  request_allow_status_or_index_not_ready "GET /showrooms?city=Kyiv" \
    "${BASE_URL}/showrooms?city=Kyiv"
  request_allow_status_or_index_not_ready "GET /showrooms?city=Cherkasy" \
    "${BASE_URL}/showrooms?city=Cherkasy"
  request_allow_status_or_index_not_ready "GET /showrooms?city=Zaporizhzhia" \
    "${BASE_URL}/showrooms?city=Zaporizhzhia"
  http_request "GET /lookbooks (filtered)" 200 "" "${BASE_URL}/lookbooks?country=Ukraine&seasonKey=ss-2026"

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

  print_section "Public list paging meta"
  MULTI_PREFIX=$(curl -s "${BASE_URL}/showrooms?geohashPrefixes=u4,u5&limit=2")
  echo "$MULTI_PREFIX"
  PAGING_MODE=$(json_get "$MULTI_PREFIX" '.meta.paging // empty')
  NEXT_CURSOR=$(json_get "$MULTI_PREFIX" '.meta.nextCursor')
  HAS_MORE=$(json_get "$MULTI_PREFIX" '.meta.hasMore')
  assert_eq "$PAGING_MODE" "disabled" "meta.paging for multi-prefix"
  assert_eq "$NEXT_CURSOR" "null" "meta.nextCursor for multi-prefix"
  assert_eq "$HAS_MORE" "false" "meta.hasMore for multi-prefix"

  NO_RESULTS=$(curl -s "${BASE_URL}/showrooms?q=zzzzzzzzzzzzzzzzzzzz&limit=5")
  echo "$NO_RESULTS"
  NO_COUNT=$(json_get "$NO_RESULTS" '.data.showrooms // [] | length')
  NO_PAGING=$(json_get "$NO_RESULTS" '.meta.paging // empty')
  NO_CURSOR=$(json_get "$NO_RESULTS" '.meta.nextCursor')
  NO_MORE=$(json_get "$NO_RESULTS" '.meta.hasMore')
  assert_eq "$NO_COUNT" "0" "no-results count"
  assert_eq "$NO_CURSOR" "null" "meta.nextCursor for no-results"
  assert_eq "$NO_MORE" "false" "meta.hasMore for no-results"
  assert_eq "$NO_PAGING" "end" "meta.paging for no-results"

  LOOKBOOK_COUNT=$(json_get "$LAST_BODY" '.data.lookbooks // [] | length')
  if [[ "$LOOKBOOK_COUNT" != "0" ]]; then
    FIRST_LOOKBOOK_ID=$(json_get "$LAST_BODY" '.data.lookbooks[0].id // empty')
    HAS_UNPUBLISHED=$(json_get "$LAST_BODY" '.data.lookbooks // [] | map(select(.published == false)) | length')
    if [[ "$HAS_UNPUBLISHED" != "0" ]]; then
      fail "Unpublished lookbook leaked to public list"
    fi

    COVER_URL=$(json_get "$LAST_BODY" '.data.lookbooks[0].coverUrl // empty')
    COVER_PATH=$(json_get "$LAST_BODY" '.data.lookbooks[0].coverPath // empty')
    assert_non_empty "$COVER_PATH" "coverPath"
    assert_non_empty "$COVER_URL" "coverUrl"
    assert_non_empty "$FIRST_LOOKBOOK_ID" "first lookbook id"
    if [[ "$COVER_URL" != http* ]]; then
      fail "coverUrl is not a URL"
    fi
  else
    echo "⚠ No lookbooks returned (seed not run)"
    FIRST_LOOKBOOK_ID=""
  fi

  print_section "Collections stubs (public)"
  http_request "GET /collections/favorites/showrooms" 200 "" \
    "${BASE_URL}/collections/favorites/showrooms"
  http_request "GET /collections/favorites/lookbooks (auth required)" 401 "AUTH_MISSING" \
    "${BASE_URL}/collections/favorites/lookbooks"
  http_request "GET /collections/want-to-visit/events (auth required)" 401 "AUTH_MISSING" \
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
}

run_authenticated_smoke_suite() {
  local auth_header=("$@")
  local first_lookbook_id=${FIRST_LOOKBOOK_ID:-}

  print_section "Auth contract (with token)"
  ME_RESPONSE=$(curl -s "${auth_header[@]}" "${BASE_URL}/users/me")
  echo "$ME_RESPONSE"
  USER_ROLE=$(json_get "$ME_RESPONSE" '.data.role // empty')
  ONBOARDING_STATE=$(json_get "$ME_RESPONSE" '.data.onboardingState // empty')
  assert_non_empty "$USER_ROLE" "role"
  assert_non_empty "$ONBOARDING_STATE" "onboardingState"
  echo "✔ role=$USER_ROLE onboardingState=$ONBOARDING_STATE"

  print_section "RBAC (lookbooks create)"
  if [[ "$USER_ROLE" == "user" ]]; then
    http_request "USER → POST /lookbooks/create" 403 "FORBIDDEN" \
      -X POST "${auth_header[@]}" -H "$(json_header)" \
      -d '{"name":"Test"}' \
      "${BASE_URL}/lookbooks/create"
  else
    http_request "OWNER → POST /lookbooks/create" 200 "" \
      -X POST "${auth_header[@]}" -H "$(json_header)" \
      -d '{"name":"Test"}' \
      "${BASE_URL}/lookbooks/create"
  fi

  print_section "Events RSVP (MVP2-only)"
  http_request "POST /events/{id}/rsvp" 501 "EVENTS_WRITE_MVP2_ONLY" \
    -X POST "${auth_header[@]}" \
    "${BASE_URL}/events/event-test-1/rsvp"

  print_section "Collections want-to-visit (auth)"
  http_request "GET /collections/want-to-visit/events" 200 "" \
    "${auth_header[@]}" \
    "${BASE_URL}/collections/want-to-visit/events"

  print_section "Lookbooks RSVP (stub)"
  http_request "POST /lookbooks/{id}/rsvp" 200 "" \
    -X POST "${auth_header[@]}" \
    "${BASE_URL}/lookbooks/event-test-1/rsvp"

  if [[ -n "$first_lookbook_id" ]]; then
    print_section "Lookbooks favorites MVP1"
    http_request "GET /lookbooks/{id}" 200 "" \
      "${BASE_URL}/lookbooks/${first_lookbook_id}"
    http_request "POST /lookbooks/{id}/favorite" 200 "" \
      -X POST "${auth_header[@]}" \
      "${BASE_URL}/lookbooks/${first_lookbook_id}/favorite"
    http_request "GET /collections/favorites/lookbooks" 200 "" \
      "${auth_header[@]}" \
      "${BASE_URL}/collections/favorites/lookbooks?limit=20"
    http_request "DELETE /lookbooks/{id}/favorite" 200 "" \
      -X DELETE "${auth_header[@]}" \
      "${BASE_URL}/lookbooks/${first_lookbook_id}/favorite"
    http_request "POST /collections/favorites/lookbooks/sync (empty)" 200 "" \
      -X POST "${auth_header[@]}" -H "$(json_header)" \
      -d '{"favoriteIds":[]}' \
      "${BASE_URL}/collections/favorites/lookbooks/sync"
  fi

  print_section "Country restrictions"
  http_request "POST /users/complete-onboarding (UA)" 200 "" \
    -X POST "${auth_header[@]}" -H "$(json_header)" \
    -d '{"country":"Ukraine"}' \
    "${BASE_URL}/users/complete-onboarding"

  http_request "POST /users/complete-onboarding (RU blocked)" 403 "COUNTRY_BLOCKED" \
    -X POST "${auth_header[@]}" -H "$(json_header)" \
    -d '{"country":"Russia"}' \
    "${BASE_URL}/users/complete-onboarding"

  print_section "Seeded lookbooks do not block country change"
  ME_CHECK=$(curl -s "${auth_header[@]}" "${BASE_URL}/users/me")
  CURRENT_COUNTRY=$(json_get "$ME_CHECK" '.data.country // empty')
  TARGET_COUNTRY="Poland"
  if [[ "$CURRENT_COUNTRY" == "Poland" ]]; then
    TARGET_COUNTRY="Ukraine"
  fi

  LOOKBOOKS_RESPONSE=$(curl -s "${BASE_URL}/lookbooks?country=Ukraine&seasonKey=ss-2026&limit=1")
  HAS_LOOKBOOKS=$(json_get "$LOOKBOOKS_RESPONSE" '.data.lookbooks // [] | length')
  if [[ "$HAS_LOOKBOOKS" == "0" ]]; then
    echo "⚠ No lookbooks returned (seed not run); skipping country change check"
  else
    COUNTRY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
      -X PATCH "${auth_header[@]}" -H "$(json_header)" \
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
      # Revert to original country if changed by the test.
      if [[ -n "$CURRENT_COUNTRY" && "$CURRENT_COUNTRY" != "$TARGET_COUNTRY" ]]; then
        curl -s -X PATCH "${auth_header[@]}" -H "$(json_header)" \
          -d "{\"country\":\"${CURRENT_COUNTRY}\"}" \
          "${BASE_URL}/users/profile" >/dev/null
      fi
    fi
  fi
}
