#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
"$SCRIPT_DIR/test_showrooms_flow.sh"
"$SCRIPT_DIR/test_lookbooks_flow.sh"
"$SCRIPT_DIR/test_events_flow.sh"
