#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
"$SCRIPT_DIR/../test_suggestions_and_counters.sh"
"$SCRIPT_DIR/../test_user_delete.sh"
