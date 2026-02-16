#!/usr/bin/env bash

run_showrooms_admin_suite() {
  print_section "Admin approve + geo preserved"
  local admin_header=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")

  http_request "POST /admin/showrooms/{id}/approve" 200 "" \
    -X POST "${admin_header[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/admin/showrooms/$SHOWROOM_ID/approve"

  http_request "GET after approve (geo)" 200 "" \
    "${AUTH_HEADER[@]}" \
    "${BASE_URL}/showrooms/$SHOWROOM_ID"

  assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.city')" "$GEO_CITY_2" "geo.city after approve"
  assert_eq "$(json_get "$LAST_BODY" '.data.showroom.geo.cityNormalized')" "zaporizhzhia" "geo.cityNormalized after approve"
  GEOHASH=$(json_get "$LAST_BODY" '.data.showroom.geo.geohash // empty')
  assert_non_empty "$GEOHASH" "geo.geohash after approve"

  print_section "City search (public)"
  request_allow_status_or_index_not_ready "GET /showrooms?city=${GEO_CITY_2}" \
    "${BASE_URL}/showrooms?city=${GEO_CITY_2}"
  if [[ "$LAST_STATUS" == "503" ]]; then
    echo "⚠ Firestore index is still building; skipping city search assertion"
  else
    FOUND_COUNT=$(echo "$LAST_BODY" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
    assert_eq "$FOUND_COUNT" "1" "showroom found by city filter"
  fi

  print_section "Search + marker payload"
  assert_non_empty "$GEOHASH" "geo.geohash"
  GEO_PREFIX="${GEOHASH:0:5}"

  LIST_RESPONSE=$(curl -s "${BASE_URL}/showrooms?geohashPrefix=${GEO_PREFIX}&fields=marker&limit=20")
  echo "$LIST_RESPONSE"
  FOUND_COUNT=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
  assert_eq "$FOUND_COUNT" "1" "showroom found by geohashPrefix"

  MARKER_NAME=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .name // empty')
  MARKER_LAT=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .geo.coords.lat // empty')
  MARKER_TYPE=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .type // empty')
  MARKER_CATEGORY=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms[] | select(.id == $id) | .category // empty')
  assert_non_empty "$MARKER_NAME" "marker name"
  assert_non_empty "$MARKER_LAT" "marker geo.coords.lat"
  assert_non_empty "$MARKER_TYPE" "marker type"
  assert_eq "$MARKER_CATEGORY" "womenswear" "marker category"

  print_section "Geohash paging (public)"
  PAGE1=$(curl -s "${BASE_URL}/showrooms?geohashPrefix=${GEO_PREFIX}&limit=2")
  echo "$PAGE1"
  CURSOR1=$(echo "$PAGE1" | jq -r '.meta.nextCursor // empty')
  IDS_PAGE1=$(echo "$PAGE1" | jq -r '.data.showrooms // [] | map(.id) | @json')
  if [[ -n "$CURSOR1" ]]; then
    PAGE2=$(curl -s "${BASE_URL}/showrooms?geohashPrefix=${GEO_PREFIX}&limit=2&cursor=${CURSOR1}")
    echo "$PAGE2"
    IDS_PAGE2=$(echo "$PAGE2" | jq -r '.data.showrooms // [] | map(.id) | @json')
    DUP_COUNT=$(jq -n --argjson a "$IDS_PAGE1" --argjson b "$IDS_PAGE2" '$a + $b | group_by(.) | map(select(length>1)) | length')
    assert_eq "$DUP_COUNT" "0" "geohash paging should not duplicate ids"
  fi

  print_section "Filters: brand + subcategories (public)"
  request_allow_status_or_index_not_ready "GET /showrooms?subcategories=dresses&limit=20" \
    "${BASE_URL}/showrooms?subcategories=dresses&limit=20"
  if [[ "$LAST_STATUS" == "503" ]]; then
    echo "⚠ Firestore index is still building; skipping subcategories filter assertion"
  else
    FOUND_COUNT=$(echo "$LAST_BODY" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
    assert_eq "$FOUND_COUNT" "1" "showroom found by subcategories filter"
  fi

  request_allow_status_or_index_not_ready "GET /showrooms?brand=zara&limit=20" \
    "${BASE_URL}/showrooms?brand=zara&limit=20"
  if [[ "$LAST_STATUS" == "503" ]]; then
    echo "⚠ Firestore index is still building; skipping brand filter assertion"
  else
    FOUND_COUNT=$(echo "$LAST_BODY" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
    assert_eq "$FOUND_COUNT" "1" "showroom found by brand filter"
  fi

  request_allow_status_or_index_not_ready "GET /showrooms?brand=zara&subcategories=dresses&limit=20" \
    "${BASE_URL}/showrooms?brand=zara&subcategories=dresses&limit=20"
  if [[ "$LAST_STATUS" == "503" ]]; then
    echo "⚠ Firestore index is still building; skipping brand+subcategory filter assertion"
  else
    FOUND_COUNT=$(echo "$LAST_BODY" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
    assert_eq "$FOUND_COUNT" "1" "showroom found by brand+subcategory filter"

    LIST_RESPONSE=$(curl -s "${BASE_URL}/showrooms?brand=zara&subcategories=dresses&limit=1")
    echo "$LIST_RESPONSE"
    NEXT_CURSOR=$(echo "$LIST_RESPONSE" | jq -r '.meta.nextCursor // empty')
    if [[ -n "$NEXT_CURSOR" ]]; then
      LIST_RESPONSE=$(curl -s "${BASE_URL}/showrooms?brand=zara&subcategories=dresses&limit=1&cursor=${NEXT_CURSOR}")
      echo "$LIST_RESPONSE"
    fi
  fi

  print_section "Brand + name search (public)"
  NAME_PREFIX="${SUBMITTED_NAME:0:3}"
  LIST_RESPONSE=$(curl -s "${BASE_URL}/showrooms?q=${NAME_PREFIX}&limit=20")
  echo "$LIST_RESPONSE"
  FOUND_COUNT=$(echo "$LIST_RESPONSE" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
  assert_eq "$FOUND_COUNT" "1" "showroom found by name prefix"

  print_section "qMode=city (public)"
  request_allow_status_or_index_not_ready "GET /showrooms?q=${GEO_CITY_2}&qMode=city&limit=20" \
    "${BASE_URL}/showrooms?q=${GEO_CITY_2}&qMode=city&limit=20"
  if [[ "$LAST_STATUS" == "503" ]]; then
    echo "⚠ Firestore index is still building; skipping qMode=city assertion"
  else
    FOUND_COUNT=$(echo "$LAST_BODY" | jq -r --arg id "$SHOWROOM_ID" '.data.showrooms // [] | map(select(.id == $id)) | length')
    assert_eq "$FOUND_COUNT" "1" "showroom found by qMode=city"
  fi
}
