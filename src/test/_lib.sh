#!/usr/bin/env bash
set -euo pipefail

# load_env
load_env() {
  ENV="${NODE_ENV:-dev}"
  ENV_FILE=".env.${ENV}"
  if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found" >&2
    exit 1
  fi

  # Export .env entries (skip comments + private key line)
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    if ! export "${key}=${value}"; then
      echo "❌ Failed to parse $ENV_FILE" >&2
      exit 1
    fi
  done < <(grep -v '^#' "$ENV_FILE" | grep -v FIREBASE_PRIVATE_KEY)
}

# require_env
require_env() {
  local var
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      echo "❌ $var is required" >&2
      exit 1
    fi
  done
}

# require_cmd
require_cmd() {
  local cmd
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "❌ Required command not found: $cmd" >&2
      exit 1
    fi
  done
}

# preflight_server
preflight_server() {
  local base_url=$1
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/health")
  if [[ "$status" != "200" ]]; then
    if [[ "$base_url" == http://localhost* ]]; then
      echo "❌ Server not running at ${base_url} (try: npm run dev)" >&2
    else
      echo "❌ Server not reachable at ${base_url}" >&2
    fi
    exit 1
  fi
}

# resolve_base_url
resolve_base_url() {
  local base_url=${BASE_URL:-""}
  if [[ -z "$base_url" ]]; then
    base_url="http://localhost:${PORT:-3005}/api/v1"
  fi
  # strip trailing slash
  base_url="${base_url%/}"
  echo "$base_url"
}

# warn_if_prod_write
warn_if_prod_write() {
  local base_url=$1
  local env=${NODE_ENV:-dev}
  if [[ "$env" == "prod" || "$base_url" != http://localhost* ]]; then
    echo "⚠ NOT for prod: this test writes data"
  fi
}

# print_section
print_section() {
  echo
  echo "====================================="
  echo " $1"
  echo "====================================="
}

# fail
fail() {
  echo "❌ $1" >&2
  exit 1
}

# now_ns
now_ns() {
  date +%s%N
}

# json_get
json_get() {
  local body=$1
  local jq_expr=$2
  echo "$body" | jq -r "$jq_expr"
}

# assert_eq
assert_eq() {
  local actual=$1
  local expected=$2
  local label=${3:-"value"}
  if [[ "$actual" != "$expected" ]]; then
    fail "Expected $label=$expected, got $actual"
  fi
}

# assert_non_empty
assert_non_empty() {
  local value=$1
  local label=${2:-"value"}
  if [[ -z "$value" || "$value" == "null" ]]; then
    fail "$label is empty"
  fi
}

# assert_gt
assert_gt() {
  local current=$1
  local prev=$2
  local label=${3:-"value"}
  if (( current <= prev )); then
    fail "Expected $label to increase (prev=$prev, current=$current)"
  fi
}

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
    RESPONSE=$(curl -s --max-time "$max_time" --connect-timeout "$connect_timeout" -w "\nHTTP_STATUS:%{http_code}" "$@") || fail "curl failed"
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

# auth_header
auth_header() {
  echo "Authorization: Bearer $1"
}

# json_header
json_header() {
  echo "Content-Type: application/json"
}
