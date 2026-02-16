#!/usr/bin/env bash

run_lookbooks_suite() {
  NOW=$(now_ns)
  PREFIX="lookbooks_mvp1_${NOW}"

  print_section "Seed lookbooks for MVP1 tests"
  SEED_RAW=$(NODE_ENV="${NODE_ENV:-dev}" node scripts/seed_test_lookbooks.js "$PREFIX")
  SEED_JSON=$(echo "$SEED_RAW" | tail -n 1)
  echo "$SEED_RAW"
  echo "$SEED_JSON" | jq -e . >/dev/null || fail "Seed script did not return valid JSON payload"

  RANKED1_ID=$(echo "$SEED_JSON" | jq -r '.ranked1Id')
  RANKED2_ID=$(echo "$SEED_JSON" | jq -r '.ranked2Id')
  UNRANKED_ID=$(echo "$SEED_JSON" | jq -r '.unrankedId')
  OTHER_SEASON_ID=$(echo "$SEED_JSON" | jq -r '.otherSeasonId')
  OTHER_COUNTRY_ID=$(echo "$SEED_JSON" | jq -r '.otherCountryId')
  HIDDEN_ID=$(echo "$SEED_JSON" | jq -r '.hiddenId')
  MISSING_ID="${PREFIX}_missing_1"

  assert_non_empty "$RANKED1_ID" "ranked1"
  assert_non_empty "$RANKED2_ID" "ranked2"
  assert_non_empty "$UNRANKED_ID" "unranked"

  print_section "1) Public list with required filters"
  http_request "GET /lookbooks filtered" 200 "" \
    "${BASE_URL}/lookbooks?country=Ukraine&seasonKey=ss-2026&limit=20"

  HAS_RANKED1=$(echo "$LAST_BODY" | jq -r --arg id "$RANKED1_ID" '.data.lookbooks[]?.id | select(. == $id)')
  HAS_RANKED2=$(echo "$LAST_BODY" | jq -r --arg id "$RANKED2_ID" '.data.lookbooks[]?.id | select(. == $id)')
  HAS_UNRANKED=$(echo "$LAST_BODY" | jq -r --arg id "$UNRANKED_ID" '.data.lookbooks[]?.id | select(. == $id)')
  HAS_OTHER_SEASON=$(echo "$LAST_BODY" | jq -r --arg id "$OTHER_SEASON_ID" '.data.lookbooks[]?.id | select(. == $id)')
  HAS_OTHER_COUNTRY=$(echo "$LAST_BODY" | jq -r --arg id "$OTHER_COUNTRY_ID" '.data.lookbooks[]?.id | select(. == $id)')
  HAS_HIDDEN=$(echo "$LAST_BODY" | jq -r --arg id "$HIDDEN_ID" '.data.lookbooks[]?.id | select(. == $id)')

  assert_non_empty "$HAS_RANKED1" "ranked1 in list"
  assert_non_empty "$HAS_RANKED2" "ranked2 in list"
  assert_non_empty "$HAS_UNRANKED" "unranked in list"
  if [[ -n "$HAS_OTHER_SEASON" ]]; then
    fail "Other season lookbook must not be in filtered list"
  fi
  if [[ -n "$HAS_OTHER_COUNTRY" ]]; then
    fail "Other country lookbook must not be in filtered list"
  fi
  if [[ -n "$HAS_HIDDEN" ]]; then
    fail "Unpublished lookbook must not be in filtered list"
  fi

  FIRST_COVER_URL=$(echo "$LAST_BODY" | jq -r '.data.lookbooks[0].coverUrl // empty')
  assert_non_empty "$FIRST_COVER_URL" "coverUrl"

  print_section "2) Cursor pagination"
  http_request "GET /lookbooks page 1" 200 "" \
    "${BASE_URL}/lookbooks?country=Ukraine&seasonKey=ss-2026&limit=1"

  PAGE1_ID=$(echo "$LAST_BODY" | jq -r '.data.lookbooks[0].id // empty')
  NEXT_CURSOR=$(echo "$LAST_BODY" | jq -r '.meta.nextCursor // empty')
  PAGING=$(echo "$LAST_BODY" | jq -r '.meta.paging // empty')
  assert_non_empty "$PAGE1_ID" "page1 id"
  assert_non_empty "$NEXT_CURSOR" "next cursor"
  assert_eq "$PAGING" "enabled" "meta.paging"

  http_request "GET /lookbooks page 2" 200 "" \
    "${BASE_URL}/lookbooks?country=Ukraine&seasonKey=ss-2026&limit=1&cursor=${NEXT_CURSOR}"

  PAGE2_ID=$(echo "$LAST_BODY" | jq -r '.data.lookbooks[0].id // empty')
  if [[ "$PAGE2_ID" == "$PAGE1_ID" ]]; then
    fail "Page 2 must differ from page 1"
  fi

  print_section "3) Invalid filter contract"
  http_request "GET /lookbooks missing country" 400 "QUERY_INVALID" \
    "${BASE_URL}/lookbooks?seasonKey=ss-2026"

  http_request "GET /lookbooks missing seasonKey" 400 "QUERY_INVALID" \
    "${BASE_URL}/lookbooks?country=Ukraine"

  http_request "GET /lookbooks invalid cursor" 400 "CURSOR_INVALID" \
    "${BASE_URL}/lookbooks?country=Ukraine&seasonKey=ss-2026&cursor=bad"

  print_section "4) Detail endpoint signs cover and images"
  http_request "GET /lookbooks/{id}" 200 "" \
    "${BASE_URL}/lookbooks/${RANKED1_ID}"

  DETAIL_COVER_URL=$(echo "$LAST_BODY" | jq -r '.data.lookbook.coverUrl // empty')
  DETAIL_IMAGE_URL=$(echo "$LAST_BODY" | jq -r '.data.lookbook.images[0].url // empty')
  assert_non_empty "$DETAIL_COVER_URL" "detail coverUrl"
  assert_non_empty "$DETAIL_IMAGE_URL" "detail image url"

  http_request "GET /lookbooks/{hiddenId} unpublished" 404 "LOOKBOOK_NOT_FOUND" \
    "${BASE_URL}/lookbooks/${HIDDEN_ID}"

  print_section "5) Favorite add/remove"
  http_request "POST /lookbooks/{id}/favorite" 200 "" \
    -X POST "${AUTH_HEADER[@]}" \
    "${BASE_URL}/lookbooks/${RANKED1_ID}/favorite"

  http_request "POST /lookbooks/{id}/favorite idempotent" 200 "" \
    -X POST "${AUTH_HEADER[@]}" \
    "${BASE_URL}/lookbooks/${RANKED1_ID}/favorite"

  http_request "GET /collections/favorites/lookbooks" 200 "" \
    "${AUTH_HEADER[@]}" \
    "${BASE_URL}/collections/favorites/lookbooks?limit=100"

  HAS_FAVORITE=$(echo "$LAST_BODY" | jq -r --arg id "$RANKED1_ID" '.data.items[]?.id | select(. == $id)')
  assert_non_empty "$HAS_FAVORITE" "favorited lookbook in collection"

  http_request "DELETE /lookbooks/{id}/favorite" 200 "" \
    -X DELETE "${AUTH_HEADER[@]}" \
    "${BASE_URL}/lookbooks/${RANKED1_ID}/favorite"

  http_request "DELETE /lookbooks/{id}/favorite idempotent" 200 "" \
    -X DELETE "${AUTH_HEADER[@]}" \
    "${BASE_URL}/lookbooks/${RANKED1_ID}/favorite"

  print_section "6) Guest sync (dedupe/invalid/unpublished/idempotent)"
  PAYLOAD=$(jq -nc --arg a "$RANKED2_ID" --arg b "$RANKED2_ID" --arg bad "$MISSING_ID" --arg hidden "$HIDDEN_ID" \
    '{favoriteIds: [$a, $b, $bad, $hidden]}')
  http_request "POST /collections/favorites/lookbooks/sync" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "$PAYLOAD" \
    "${BASE_URL}/collections/favorites/lookbooks/sync"

  HAS_APPLIED=$(echo "$LAST_BODY" | jq -r --arg id "$RANKED2_ID" '.data.applied.favorites[]? | select(. == $id)')
  HAS_MISSING_SKIPPED=$(echo "$LAST_BODY" | jq -r --arg id "$MISSING_ID" '.data.skipped[]? | select(. == $id)')
  HAS_HIDDEN_SKIPPED=$(echo "$LAST_BODY" | jq -r --arg id "$HIDDEN_ID" '.data.skipped[]? | select(. == $id)')
  assert_non_empty "$HAS_APPLIED" "sync applied favorite"
  assert_non_empty "$HAS_MISSING_SKIPPED" "sync skipped missing"
  assert_non_empty "$HAS_HIDDEN_SKIPPED" "sync skipped hidden"

  PAYLOAD_IDEMP=$(jq -nc --arg id "$RANKED2_ID" '{favoriteIds: [$id]}')
  http_request "POST /collections/favorites/lookbooks/sync idempotent #1" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "$PAYLOAD_IDEMP" \
    "${BASE_URL}/collections/favorites/lookbooks/sync"
  FIRST_APPLIED=$(echo "$LAST_BODY" | jq -c '.data.applied')

  http_request "POST /collections/favorites/lookbooks/sync idempotent #2" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "$PAYLOAD_IDEMP" \
    "${BASE_URL}/collections/favorites/lookbooks/sync"
  SECOND_APPLIED=$(echo "$LAST_BODY" | jq -c '.data.applied')
  assert_eq "$SECOND_APPLIED" "$FIRST_APPLIED" "idempotent applied payload"

  print_section "6.1) Guest sync limit > 100 is rejected"
  TOO_MANY_IDS=$(jq -nc '[range(0;101) | "bulk_\(.)"]')
  PAYLOAD_TOO_MANY=$(jq -nc --argjson ids "$TOO_MANY_IDS" '{favoriteIds: $ids}')
  http_request "POST /collections/favorites/lookbooks/sync (>100)" 400 "LOOKBOOK_SYNC_LIMIT_EXCEEDED" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "$PAYLOAD_TOO_MANY" \
    "${BASE_URL}/collections/favorites/lookbooks/sync"

  print_section "7) Favorites list revalidates published"
  http_request "GET /users/me" 200 "" "${AUTH_HEADER[@]}" "${BASE_URL}/users/me"
  USER_UID=$(echo "$LAST_BODY" | jq -r '.data.uid // empty')
  assert_non_empty "$USER_UID" "user uid"

  node --input-type=module <<NODE_EOF
  import { Timestamp } from 'firebase-admin/firestore';
  import { getFirestoreInstance } from './src/config/firebase.js';
  const db = getFirestoreInstance();
  await db.collection('users').doc('${USER_UID}').collection('lookbooks_favorites').doc('${HIDDEN_ID}').set({
    createdAt: Timestamp.fromDate(new Date()),
  }, { merge: true });
NODE_EOF

  http_request "GET /collections/favorites/lookbooks revalidated" 200 "" \
    "${AUTH_HEADER[@]}" \
    "${BASE_URL}/collections/favorites/lookbooks?limit=100"

  HAS_HIDDEN_COLLECTION=$(echo "$LAST_BODY" | jq -r --arg id "$HIDDEN_ID" '.data.items[]?.id | select(. == $id)')
  if [[ -n "$HAS_HIDDEN_COLLECTION" ]]; then
    fail "Unpublished lookbook must not appear in favorites list"
  fi

  print_section "RESULT"
  echo "✔ Lookbooks MVP1 tests passed"
}
