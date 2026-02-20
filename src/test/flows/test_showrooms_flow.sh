#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# shellcheck source=../lib/suite.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/suite.sh"

suite_run_group "Showrooms Full Flow" \
  "$SCRIPT_DIR/../integrations/test_showrooms.sh" \
  "$SCRIPT_DIR/../integrations/test_showrooms_favorites.sh" \
  "$SCRIPT_DIR/../integrations/test_admin_and_collections.sh"
