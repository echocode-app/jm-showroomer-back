#!/usr/bin/env bash

# http_request
http_request() {
  local label=$1
  local expected_status=$2
  local expected_error_code=${3:-}
  shift 3 || true

  echo
  echo "▶ $label"

  local attempts=0
  local delay=1
  local max_attempts=${RETRY_MAX_ATTEMPTS:-5}
  local do_retry=${RETRY_ON_429:-1}

  local max_time=${CURL_MAX_TIME:-30}
  local connect_timeout=${CURL_CONNECT_TIMEOUT:-5}

  while true; do
    set +e
    RESPONSE=$(curl -s --max-time "$max_time" --connect-timeout "$connect_timeout" -w "\nHTTP_STATUS:%{http_code}" "$@")
    local rc=$?
    set -e
    if [[ "$rc" -ne 0 ]]; then
      echo "❌ curl failed (exit=$rc) for: $label" >&2
      fail "curl failed"
    fi
    LAST_STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
    LAST_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

    if [[ "$do_retry" == "1" && "$LAST_STATUS" == "429" ]]; then
      CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
      if [[ "$CODE" == "RATE_LIMIT_EXCEEDED" && "$attempts" -lt "$max_attempts" ]]; then
        attempts=$((attempts + 1))
        sleep "$delay"
        delay=$((delay * 2))
        continue
      fi
    fi
    break
  done

  echo "$LAST_BODY"

  if [[ "$LAST_STATUS" != "$expected_status" ]]; then
    fail "Expected HTTP $expected_status, got $LAST_STATUS"
  fi

  if [[ -n "$expected_error_code" ]]; then
    CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
    if [[ "$CODE" != "$expected_error_code" ]]; then
      fail "Expected error.code=$expected_error_code, got $CODE"
    fi
  fi

  echo "✔ HTTP $LAST_STATUS"
}

# request_allow_status
request_allow_status() {
  local label=$1
  local expected_status_1=$2
  local expected_status_2=$3
  local expected_error_code=${4:-}
  shift 4 || true

  echo
  echo "▶ $label"

  local max_time=${CURL_MAX_TIME:-30}
  local connect_timeout=${CURL_CONNECT_TIMEOUT:-5}
  RESPONSE=$(curl -s --max-time "$max_time" --connect-timeout "$connect_timeout" -w "\nHTTP_STATUS:%{http_code}" "$@") || fail "curl failed"
  LAST_STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
  LAST_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  echo "$LAST_BODY"

  if [[ "$LAST_STATUS" != "$expected_status_1" && "$LAST_STATUS" != "$expected_status_2" ]]; then
    fail "Expected HTTP $expected_status_1 or $expected_status_2, got $LAST_STATUS"
  fi

  if [[ -n "$expected_error_code" ]]; then
    CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
    if [[ "$CODE" != "$expected_error_code" ]]; then
      fail "Expected error.code=$expected_error_code, got $CODE"
    fi
  fi

  echo "✔ HTTP $LAST_STATUS"
}

# request_allow_status_or_index_not_ready
request_allow_status_or_index_not_ready() {
  local label=$1
  shift || true

  echo
  echo "▶ $label"

  local max_time=${CURL_MAX_TIME:-30}
  local connect_timeout=${CURL_CONNECT_TIMEOUT:-5}
  RESPONSE=$(curl -s --max-time "$max_time" --connect-timeout "$connect_timeout" -w "\nHTTP_STATUS:%{http_code}" "$@") || fail "curl failed"
  LAST_STATUS=$(echo "$RESPONSE" | sed -n 's/.*HTTP_STATUS://p')
  LAST_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  echo "$LAST_BODY"

  if [[ "$LAST_STATUS" == "503" ]]; then
    CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
    if [[ "$CODE" != "INDEX_NOT_READY" ]]; then
      fail "Expected error.code=INDEX_NOT_READY, got $CODE"
    fi
  elif [[ "$LAST_STATUS" != "200" ]]; then
    fail "Expected HTTP 200 or 503, got $LAST_STATUS"
  fi

  echo "✔ HTTP $LAST_STATUS"
}
