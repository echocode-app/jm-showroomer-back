#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

PROJECT_ID="${FIREBASE_PROJECT_ID:-}"
ENV_FILE=".env.prod"
DEPLOY_INDEXES=0
WRITE_FIREBASERC=0

usage() {
  cat <<'USAGE'
Firebase project migration helper (dry-run by default).

Usage:
  bash scripts/firebase_project_migration.sh --project <firebase-project-id> [options]

Options:
  --project <id>         Target Firebase project id (required).
  --env-file <path>      Env file to validate against target project (default: .env.prod).
  --deploy-indexes       Run: firebase deploy --only firestore:indexes --project <id>.
  --write-firebaserc     Update .firebaserc projects.default to target project id.
  -h, --help             Show help.

What this script validates:
  1) Required env keys exist: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET
  2) FIREBASE_PROJECT_ID in env file matches --project
  3) Prints deterministic pre-prod checklist to avoid missed steps.

Examples:
  bash scripts/firebase_project_migration.sh --project owner-project-123
  bash scripts/firebase_project_migration.sh --project owner-project-123 --env-file .env.prod --deploy-indexes
  bash scripts/firebase_project_migration.sh --project owner-project-123 --write-firebaserc --deploy-indexes
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --deploy-indexes)
      DEPLOY_INDEXES=1
      shift
      ;;
    --write-firebaserc)
      WRITE_FIREBASERC=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: --project is required."
  usage
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE"
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "Error: firebase CLI is required."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required."
  exit 1
fi

read_env_value() {
  local key="$1"
  local file="$2"
  local value
  value=$(grep -E "^${key}=" "$file" | head -n1 | cut -d= -f2- || true)
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

require_env_key() {
  local key="$1"
  local value
  value=$(read_env_value "$key" "$ENV_FILE")
  if [[ -z "$value" ]]; then
    echo "Error: $key is missing or empty in $ENV_FILE"
    exit 1
  fi
}

echo "== Firebase migration dry-run =="
echo "Target project : $PROJECT_ID"
echo "Env file       : $ENV_FILE"
echo

require_env_key "FIREBASE_PROJECT_ID"
require_env_key "FIREBASE_CLIENT_EMAIL"
require_env_key "FIREBASE_PRIVATE_KEY"
require_env_key "FIREBASE_STORAGE_BUCKET"

ENV_PROJECT_ID=$(read_env_value "FIREBASE_PROJECT_ID" "$ENV_FILE")
ENV_BUCKET=$(read_env_value "FIREBASE_STORAGE_BUCKET" "$ENV_FILE")

if [[ "$ENV_PROJECT_ID" != "$PROJECT_ID" ]]; then
  echo "Error: FIREBASE_PROJECT_ID in $ENV_FILE ($ENV_PROJECT_ID) does not match --project ($PROJECT_ID)."
  exit 1
fi

if [[ "$ENV_BUCKET" != *"$PROJECT_ID"* ]]; then
  echo "Warning: FIREBASE_STORAGE_BUCKET does not contain project id substring."
  echo "  bucket: $ENV_BUCKET"
  echo "  project: $PROJECT_ID"
  echo "Please verify this is intentional."
fi

echo "Env validation: OK"

if [[ "$WRITE_FIREBASERC" -eq 1 ]]; then
  if [[ ! -f ".firebaserc" ]]; then
    echo '{"projects":{"default":""}}' > .firebaserc
  fi
  tmp_file="$(mktemp)"
  jq --arg project "$PROJECT_ID" '.projects.default = $project' .firebaserc > "$tmp_file"
  mv "$tmp_file" .firebaserc
  echo ".firebaserc updated: projects.default=$PROJECT_ID"
else
  echo ".firebaserc not changed (pass --write-firebaserc to update)."
fi

if [[ "$DEPLOY_INDEXES" -eq 1 ]]; then
  echo
  echo "Deploying Firestore indexes..."
  firebase deploy --only firestore:indexes --project "$PROJECT_ID"
else
  echo
  echo "Indexes deploy skipped (pass --deploy-indexes to run)."
fi

cat <<CHECKLIST

== Pre-prod migration checklist ==
1) Update environment secrets in target runtime:
   - FIREBASE_PROJECT_ID=$PROJECT_ID
   - FIREBASE_CLIENT_EMAIL
   - FIREBASE_PRIVATE_KEY
   - FIREBASE_STORAGE_BUCKET
2) Deploy Firestore indexes:
   firebase deploy --only firestore:indexes --project "$PROJECT_ID"
3) Validate OpenAPI:
   npx @redocly/cli lint docs/openapi.yaml
4) Run smoke + domain regressions against target backend:
   NODE_ENV=test ./src/test/test_smoke.sh
   NODE_ENV=test ./src/test/test_events_mvp1.sh
   NODE_ENV=test ./src/test/test_events_guest_sync.sh
   NODE_ENV=test ./src/test/test_lookbooks.sh
   NODE_ENV=test ./src/test/test_admin_and_collections.sh
5) Cleanup test fixtures:
   npm run test:cleanup:dry
   npm run test:cleanup
CHECKLIST

echo
echo "Migration helper finished."
