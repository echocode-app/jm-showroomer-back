#!/usr/bin/env bash

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
  local status=""
  local rc=0
  local attempt=1
  local max_attempts=${HEALTH_MAX_ATTEMPTS:-20}
  local delay=${HEALTH_RETRY_DELAY:-1}
  local max_time=${CURL_MAX_TIME:-10}
  local connect_timeout=${CURL_CONNECT_TIMEOUT:-3}

  echo "ℹ️  Preflight ${base_url}/health"

  while (( attempt <= max_attempts )); do
    set +e
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$max_time" --connect-timeout "$connect_timeout" "${base_url}/health")
    rc=$?
    set -e

    if [[ "$rc" -eq 0 && "$status" == "200" ]]; then
      return 0
    fi
    echo "⚠ Health check attempt ${attempt}/${max_attempts} failed (curl=$rc, status=${status:-none})"
    sleep "$delay"
    attempt=$((attempt + 1))
  done

  if [[ "$base_url" == http://localhost* ]]; then
    echo "❌ Server not running at ${base_url} (try: npm run dev)" >&2
  else
    echo "❌ Server not reachable at ${base_url}" >&2
  fi
  exit 1
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

# is_prod_base_url
is_prod_base_url() {
  local base_url=$1
  if [[ "${NODE_ENV:-}" == "prod" || "${PROD_GUARD:-}" == "1" ]]; then
    return 0
  fi
  if [[ "$base_url" == *"onrender.com"* || "$base_url" == *"render.com"* || "$base_url" == *"production"* || "$base_url" == *"prod."* ]]; then
    return 0
  fi
  return 1
}

# guard_prod_write
guard_prod_write() {
  local base_url=$1
  if is_prod_base_url "$base_url" && [[ "${ALLOW_PROD_WRITE:-}" != "1" ]]; then
    echo "❌ Prod write guard: refusing to run write tests against ${base_url} without ALLOW_PROD_WRITE=1" >&2
    exit 1
  fi
}

# print_section
print_section() {
  echo
  echo "====================================="
  echo " $1"
  echo "====================================="
}

# now_ns
now_ns() {
  date +%s%N
}

# auth_header
auth_header() {
  echo "Authorization: Bearer $1"
}

# json_header
json_header() {
  echo "Content-Type: application/json"
}
