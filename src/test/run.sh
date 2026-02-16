#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "Usage: $0 smoke|showrooms|showrooms-favorites|admin|events|events-guest-sync|lookbooks|geo|suggestions|media|user-delete|prod-smoke|all|all-with-user-delete|all-full"
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
  lookbooks)
    "$SCRIPT_DIR/test_lookbooks.sh"
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
  all)
    "$SCRIPT_DIR/test_smoke.sh"
    "$SCRIPT_DIR/test_showrooms.sh"
    "$SCRIPT_DIR/test_showrooms_favorites.sh"
    "$SCRIPT_DIR/test_admin_and_collections.sh"
    "$SCRIPT_DIR/test_geo_paging_checks.sh"
    "$SCRIPT_DIR/test_suggestions_and_counters.sh"
    "$SCRIPT_DIR/test_events_mvp1.sh"
    "$SCRIPT_DIR/test_events_guest_sync.sh"
    "$SCRIPT_DIR/test_lookbooks.sh"
    ;;
  all-with-user-delete)
    "$SCRIPT_DIR/test_smoke.sh"
    "$SCRIPT_DIR/test_showrooms.sh"
    "$SCRIPT_DIR/test_showrooms_favorites.sh"
    "$SCRIPT_DIR/test_admin_and_collections.sh"
    "$SCRIPT_DIR/test_geo_paging_checks.sh"
    "$SCRIPT_DIR/test_suggestions_and_counters.sh"
    "$SCRIPT_DIR/test_events_mvp1.sh"
    "$SCRIPT_DIR/test_events_guest_sync.sh"
    "$SCRIPT_DIR/test_lookbooks.sh"
    "$SCRIPT_DIR/test_user_delete.sh"
    ;;
  all-full)
    "$SCRIPT_DIR/test_smoke.sh"
    "$SCRIPT_DIR/test_showrooms.sh"
    "$SCRIPT_DIR/test_showrooms_favorites.sh"
    "$SCRIPT_DIR/test_admin_and_collections.sh"
    "$SCRIPT_DIR/test_geo_paging_checks.sh"
    "$SCRIPT_DIR/test_suggestions_and_counters.sh"
    "$SCRIPT_DIR/test_events_mvp1.sh"
    "$SCRIPT_DIR/test_events_guest_sync.sh"
    "$SCRIPT_DIR/test_lookbooks.sh"
    "$SCRIPT_DIR/test_user_delete.sh"
    "$SCRIPT_DIR/test_media.sh"
    ;;
  *)
    usage
    exit 1
    ;;
esac
