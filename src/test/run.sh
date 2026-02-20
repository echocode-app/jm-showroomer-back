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
    case "$target" in
      smoke) "$SCRIPT_DIR/core/test_smoke.sh" ;;
      showrooms) "$SCRIPT_DIR/integrations/test_showrooms.sh" ;;
      showrooms-favorites|showrooms_favorites) "$SCRIPT_DIR/integrations/test_showrooms_favorites.sh" ;;
      admin|admin-and-collections|admin_and_collections) "$SCRIPT_DIR/integrations/test_admin_and_collections.sh" ;;
      events|events-mvp1|events_mvp1) "$SCRIPT_DIR/integrations/test_events_mvp1.sh" ;;
      events-guest-sync|events_guest_sync) "$SCRIPT_DIR/integrations/test_events_guest_sync.sh" ;;
      events-flow|events_flow) "$SCRIPT_DIR/flows/test_events_flow.sh" ;;
      notifications) "$SCRIPT_DIR/integrations/test_notifications_storage.sh" ;;
      notifications-read|notifications_read) "$SCRIPT_DIR/integrations/test_notifications_read.sh" ;;
      notifications-full|notifications_full) "$SCRIPT_DIR/flows/test_notifications_full.sh" ;;
      lookbooks) "$SCRIPT_DIR/integrations/test_lookbooks.sh" ;;
      lookbooks-flow|lookbooks_flow) "$SCRIPT_DIR/flows/test_lookbooks_flow.sh" ;;
      geo|geo-paging-checks|geo_paging_checks) "$SCRIPT_DIR/integrations/test_geo_paging_checks.sh" ;;
      prod-smoke|prod_smoke) "$SCRIPT_DIR/prod/test_prod_readonly.sh" ;;
      media) "$SCRIPT_DIR/integrations/test_media.sh" ;;
      suggestions|suggestions-and-counters|suggestions_and_counters) "$SCRIPT_DIR/integrations/test_suggestions_and_counters.sh" ;;
      user-delete|user_delete) "$SCRIPT_DIR/integrations/test_user_delete.sh" ;;
      showrooms-flow|showrooms_flow) "$SCRIPT_DIR/flows/test_showrooms_flow.sh" ;;
      *) echo "Unknown target: $target"; usage; exit 1 ;;
    esac
  done
}

case "$TARGET" in
  smoke)
    "$SCRIPT_DIR/core/test_smoke.sh"
    ;;
  showrooms)
    "$SCRIPT_DIR/integrations/test_showrooms.sh"
    ;;
  showrooms-favorites)
    "$SCRIPT_DIR/integrations/test_showrooms_favorites.sh"
    ;;
  admin)
    "$SCRIPT_DIR/integrations/test_admin_and_collections.sh"
    ;;
  events)
    "$SCRIPT_DIR/integrations/test_events_mvp1.sh"
    ;;
  events-guest-sync)
    "$SCRIPT_DIR/integrations/test_events_guest_sync.sh"
    ;;
  events-flow)
    "$SCRIPT_DIR/flows/test_events_flow.sh"
    ;;
  notifications)
    "$SCRIPT_DIR/integrations/test_notifications_storage.sh"
    ;;
  notifications-read)
    "$SCRIPT_DIR/integrations/test_notifications_read.sh"
    ;;
  notifications-full)
    "$SCRIPT_DIR/flows/test_notifications_full.sh"
    ;;
  lookbooks)
    "$SCRIPT_DIR/integrations/test_lookbooks.sh"
    ;;
  lookbooks-flow)
    "$SCRIPT_DIR/flows/test_lookbooks_flow.sh"
    ;;
  geo)
    "$SCRIPT_DIR/integrations/test_geo_paging_checks.sh"
    ;;
  prod-smoke)
    "$SCRIPT_DIR/prod/test_prod_readonly.sh"
    ;;
  media)
    "$SCRIPT_DIR/integrations/test_media.sh"
    ;;
  suggestions)
    "$SCRIPT_DIR/integrations/test_suggestions_and_counters.sh"
    ;;
  user-delete)
    "$SCRIPT_DIR/integrations/test_user_delete.sh"
    ;;
  showrooms-flow)
    "$SCRIPT_DIR/flows/test_showrooms_flow.sh"
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
