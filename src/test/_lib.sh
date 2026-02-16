#!/usr/bin/env bash
set -euo pipefail

LIB_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib

# shellcheck source=./lib/core.sh
# shellcheck disable=SC1091
source "$LIB_DIR/core.sh"

# shellcheck source=./lib/assert.sh
# shellcheck disable=SC1091
source "$LIB_DIR/assert.sh"

# shellcheck source=./lib/requests.sh
# shellcheck disable=SC1091
source "$LIB_DIR/requests.sh"
