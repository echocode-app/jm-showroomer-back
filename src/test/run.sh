#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "Usage: $0 smoke|showrooms|showrooms-favorites|admin|events|events-guest-sync|events-flow|notifications|notifications-read|notifications-full|lookbooks|lookbooks-flow|geo|suggestions|media|user-delete|prod-smoke|showrooms-flow|all|all-with-user-delete|all-full"
}

TARGET=${1:-}
if [[ -z "$TARGET" ]]; then
  usage
  exit 1
fi

run_targets() {
  local target
  for target in "$@"; do
    "$SCRIPT_DIR/test_${target}.sh"
  done
}

case "$TARGET" in
  smoke)
    "$SCRIPT_DIR/test_smoke.sh"
    ;;
  showrooms)
    "$SCRIPT_DIR/test_showrooms.sh"
    ;;
  showrooms-favorites)
    "$SCRIPT_DIR/test_showrooms_favorites.sh"
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
  events-flow)
    "$SCRIPT_DIR/test_events_flow.sh"
    ;;
  notifications)
    "$SCRIPT_DIR/test_notifications_storage.sh"
    ;;
  notifications-read)
    "$SCRIPT_DIR/test_notifications_read.sh"
    ;;
  notifications-full)
    "$SCRIPT_DIR/test_notifications_full.sh"
    ;;
  lookbooks)
    "$SCRIPT_DIR/test_lookbooks.sh"
    ;;
  lookbooks-flow)
    "$SCRIPT_DIR/test_lookbooks_flow.sh"
    ;;
  geo)
    "$SCRIPT_DIR/test_geo_paging_checks.sh"
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
  showrooms-flow)
    "$SCRIPT_DIR/test_showrooms_flow.sh"
    ;;
  all)
    run_targets smoke showrooms showrooms_favorites admin_and_collections geo_paging_checks suggestions_and_counters events_mvp1 events_guest_sync lookbooks
    ;;
  all-with-user-delete)
    run_targets smoke showrooms showrooms_favorites admin_and_collections geo_paging_checks suggestions_and_counters events_mvp1 events_guest_sync lookbooks user_delete
    ;;
  all-full)
    run_targets smoke showrooms showrooms_favorites admin_and_collections geo_paging_checks suggestions_and_counters events_mvp1 events_guest_sync lookbooks user_delete media
    ;;
  *)
    usage
    exit 1
    ;;
esac
