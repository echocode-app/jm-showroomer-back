#!/usr/bin/env bash

# Purpose: Reusable grouped-suite runner with explicit pass/fail summary footer.

suite_run_group() {
  local title=$1
  shift

  local failed=0
  local script

  echo
  echo "====================================="
  echo " ${title}"
  echo "====================================="

  for script in "$@"; do
    echo "▶ ${script}"
    if ! "$script"; then
      failed=1
      break
    fi
  done

  echo
  if [[ "$failed" -eq 0 ]]; then
    echo "✔ Passed"
    return 0
  fi

  echo "✖ Failed"
  return 1
}
