#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "Usage: $0 smoke|showrooms|admin|events|events-guest-sync|prod-smoke|media|suggestions|user-delete|all"
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
  events)
    "$SCRIPT_DIR/test_events_mvp1.sh"
    ;;
  events-guest-sync)
    "$SCRIPT_DIR/test_events_guest_sync.sh"
    ;;
  prod-smoke)
    "$SCRIPT_DIR/test_prod_readonly.sh"
    ;;
  media)
    "$SCRIPT_DIR/test_media.sh"
    ;;
  suggestions)
    "$SCRIPT_DIR/test_suggestions_and_counters.sh"
    ;;
  user-delete)
    "$SCRIPT_DIR/test_user_delete.sh"
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
