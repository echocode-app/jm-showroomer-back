#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "Usage: $0 smoke|showrooms|admin|media|suggestions|all"
}

TARGET=${1:-}
if [[ -z "$TARGET" ]]; then
  usage
  exit 1
fi

case "$TARGET" in
  smoke)
    "$SCRIPT_DIR/test_smoke.sh"
    ;;
  showrooms)
    "$SCRIPT_DIR/test_showrooms.sh"
    ;;
  admin)
    "$SCRIPT_DIR/test_admin_and_collections.sh"
    ;;
  media)
    "$SCRIPT_DIR/test_media.sh"
    ;;
  suggestions)
    "$SCRIPT_DIR/test_suggestions_and_counters.sh"
    ;;
  all)
    "$SCRIPT_DIR/test_smoke.sh"
    "$SCRIPT_DIR/test_showrooms.sh"
    "$SCRIPT_DIR/test_admin_and_collections.sh"
    "$SCRIPT_DIR/test_media.sh"
    "$SCRIPT_DIR/test_suggestions_and_counters.sh"
    ;;
  *)
    usage
    exit 1
    ;;
esac
