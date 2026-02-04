#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
source "$SCRIPT_DIR/_lib.sh"

load_env
require_cmd curl jq node rg
require_env BASE_URL
ENV_FILE=".env.${NODE_ENV:-dev}"
if [ -f "$ENV_FILE" ]; then
  FIREBASE_PRIVATE_KEY=$(grep -v '^#' "$ENV_FILE" | grep -m1 '^FIREBASE_PRIVATE_KEY=' | cut -d= -f2-)
  FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY#\"}
  FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY%\"}
  export FIREBASE_PRIVATE_KEY
fi

BASE_URL="${BASE_URL}"
preflight_server "${BASE_URL}"

print_section "Safety guard"
if [[ -z "${FIRESTORE_EMULATOR_HOST:-}" && "${FIREBASE_PROJECT_ID:-}" != *"test"* ]]; then
  fail "Refusing to write: require FIRESTORE_EMULATOR_HOST or FIREBASE_PROJECT_ID contains 'test'"
fi
if [[ -n "${FIRESTORE_EMULATOR_HOST:-}" ]]; then
  EMU_HOST="${FIRESTORE_EMULATOR_HOST%:*}"
  EMU_PORT="${FIRESTORE_EMULATOR_HOST##*:}"
  if [[ -z "$EMU_HOST" || -z "$EMU_PORT" ]]; then
    fail "Invalid FIRESTORE_EMULATOR_HOST format (expected host:port)"
  fi
  if ! (echo > "/dev/tcp/${EMU_HOST}/${EMU_PORT}") >/dev/null 2>&1; then
    fail "Firestore emulator not reachable at ${FIRESTORE_EMULATOR_HOST}"
  fi
fi

print_section "Seed validation (invalid file type)"
SEED_DIR="scripts/seed_assets/lookbooks/invalid_seed"
mkdir -p "$SEED_DIR/cover"

echo '{"name":"Invalid Seed"}' > "$SEED_DIR/meta.json"
echo "invalid" > "$SEED_DIR/cover/cover.txt"

cleanup_seed() {
  rm -rf "scripts/seed_assets/lookbooks/invalid_seed"
}
trap cleanup_seed EXIT

set +e
SEED_OUT=$(NODE_ENV="${NODE_ENV:-dev}" node scripts/seed_content.js --dry-run 2>&1)
SEED_STATUS=$?
set -e

if [[ "$SEED_STATUS" == "0" ]]; then
  echo "$SEED_OUT"
  fail "Expected seed to fail for invalid file extension"
fi

echo "$SEED_OUT" | rg -q "Unsupported file extension" || fail "Seed error message missing"

echo "✔ Seed validation failed as expected"

print_section "Unsafe coverPath returns null coverUrl"
INVALID_IDS=("invalid-media-test-dotdot" "invalid-media-test-http" "invalid-media-test-backslash")
INVALID_PATHS=(
  "lookbooks/invalid-media-test-dotdot/../secrets.jpg"
  "http://evil.com/a.jpg"
  "lookbooks/invalid-media-test-backslash\\..\\x.jpg"
)

INVALID_IDS_JSON=$(printf '%s\n' "${INVALID_IDS[@]}" | jq -R . | jq -s .)
INVALID_PATHS_JSON=$(printf '%s\n' "${INVALID_PATHS[@]}" | jq -R . | jq -s .)

node --input-type=module <<EOF || fail "Failed to insert invalid lookbook"
  import { getFirestoreInstance } from './src/config/firebase.js';
  const db = getFirestoreInstance();
  const now = new Date().toISOString();
  const assets = [
    { kind: 'cover', path: 'lookbooks/order-zero/cover/cover.webp', order: 0, meta: null },
    { kind: 'page', path: 'lookbooks/order-zero/pages/p1.webp', order: 1, meta: null },
  ];
  await db.collection('lookbooks').doc('order-zero').set({
    name: 'Order Zero',
    published: true,
    coverPath: 'lookbooks/order-zero/cover/cover.webp',
    assets,
    createdAt: now,
    updatedAt: now,
    source: 'seed',
  }, { merge: true });
  const ids = ${INVALID_IDS_JSON};
  const paths = ${INVALID_PATHS_JSON};
  for (let i = 0; i < ids.length; i++) {
    await db.collection('lookbooks').doc(ids[i]).set({
      name: 'Invalid Media',
      published: true,
      coverPath: paths[i],
      createdAt: now,
      updatedAt: now,
      source: 'seed',
    }, { merge: true });
  }
EOF

http_request "GET /lookbooks" 200 "" "${BASE_URL}/lookbooks?limit=200"

LOOKBOOK_COUNT=$(json_get "$LAST_BODY" '.data.lookbooks // [] | length')
if [[ "$LOOKBOOK_COUNT" == "0" ]]; then
  fail "No lookbooks returned. Ensure server is using the Firestore emulator (FIRESTORE_EMULATOR_HOST=${FIRESTORE_EMULATOR_HOST})."
fi

for id in "${INVALID_IDS[@]}"; do
  FOUND=$(json_get "$LAST_BODY" ".data.lookbooks[]? | select(.id == \"${id}\") | .id // empty")
  if [[ -z "$FOUND" ]]; then
    fail "Lookbook ${id} not found in response; server may not be reading from emulator"
  fi
  COVER_URL=$(json_get "$LAST_BODY" ".data.lookbooks[] | select(.id == \"${id}\") | .coverUrl // empty")
  if [[ -n "$COVER_URL" && "$COVER_URL" != "null" ]]; then
    fail "coverUrl should be null for unsafe coverPath (${id})"
  fi
done
echo "✔ coverUrl is null for unsafe coverPath"

print_section "Order zero preserved"
node --input-type=module <<'EOF' || fail "Order zero normalization failed"
  import { normalizeLookbookAssets } from './src/utils/mediaValidation.js';
  const input = {
    assets: [
      { kind: 'cover', path: 'lookbooks/order-zero/cover/cover.webp', order: 0 },
      { kind: 'page', path: 'lookbooks/order-zero/pages/p1.webp', order: 1 },
    ],
  };
  const normalized = normalizeLookbookAssets(input);
  if (!normalized[0] || normalized[0].order !== 0) {
    throw new Error('order=0 not preserved');
  }
EOF
echo "✔ order=0 preserved"

node --input-type=module <<EOF || true
  import { getFirestoreInstance } from './src/config/firebase.js';
  const db = getFirestoreInstance();
  const ids = ${INVALID_IDS_JSON};
  for (const id of ids) {
    await db.collection('lookbooks').doc(id).delete();
  }
  await db.collection('lookbooks').doc('order-zero').delete();
EOF

print_section "RESULT"
echo "✔ Media tests passed"
