#!/usr/bin/env bash

# fail
fail() {
  echo "❌ $1" >&2
  exit 1
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
