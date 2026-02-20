#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
"$SCRIPT_DIR/integrations/test_admin_and_collections.sh"
