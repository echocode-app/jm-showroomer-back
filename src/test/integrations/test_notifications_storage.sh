#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_lib.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_lib.sh"

load_env
require_cmd curl jq node
require_env TEST_USER_TOKEN TEST_ADMIN_TOKEN

ENV_FILE=".env.${NODE_ENV:-dev}"
if [ -f "$ENV_FILE" ]; then
  FIREBASE_PRIVATE_KEY=$(grep -v '^#' "$ENV_FILE" | grep -m1 '^FIREBASE_PRIVATE_KEY=' | cut -d= -f2-)
  FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY#\"}
  FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY%\"}
  export FIREBASE_PRIVATE_KEY
fi

BASE_URL="$(resolve_base_url)"
preflight_server "${BASE_URL}"
guard_prod_write "${BASE_URL}"
warn_if_prod_write "${BASE_URL}"

AUTH_HEADER=(-H "$(auth_header "${TEST_USER_TOKEN}")")
ADMIN_HEADER=(-H "$(auth_header "${TEST_ADMIN_TOKEN}")")
JSON_HEADER=(-H "$(json_header)")
NOW=$(now_ns)
SHORT_NOW="${NOW: -6}"
SAFE_SUFFIX=$(printf '%s' "$SHORT_NOW" | tr '0-9' 'a-j')
APPROVED_ID=""
REJECTED_ID=""
DELETED_ID=""
LOOKBOOK_ID=""
EVENT_ID=""

cleanup_firestore_fixture() {
  local collection_name=$1
  local doc_id=$2
  if [[ -z "$doc_id" ]]; then
    return
  fi

  node --input-type=module - "$collection_name" "$doc_id" <<'NODE'
import { getFirestoreInstance } from "./src/config/firebase.js";

const [collectionName, docId] = process.argv.slice(2);
await getFirestoreInstance().collection(collectionName).doc(docId).delete();
NODE
}

cleanup_seeded_data() {
  cleanup_firestore_fixture "events" "$EVENT_ID"
  cleanup_firestore_fixture "lookbooks" "$LOOKBOOK_ID"
  cleanup_firestore_fixture "showrooms" "$APPROVED_ID"
  cleanup_firestore_fixture "showrooms" "$REJECTED_ID"
  cleanup_firestore_fixture "showrooms" "$DELETED_ID"
}

trap cleanup_seeded_data EXIT

ensure_owner_role() {
  local me_response
  me_response=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/users/me")
  local user_role
  user_role=$(json_get "$me_response" '.data.role // empty')
  if [[ "$user_role" == "owner" ]]; then
    return
  fi

  http_request "POST /users/complete-owner-profile (upgrade for notifications test)" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"Own ${SAFE_SUFFIX}\",\"position\":\"Founder\",\"country\":\"Ukraine\",\"instagram\":\"https://instagram.com/notif${NOW}\"}" \
    "${BASE_URL}/users/complete-owner-profile"
}

create_submittable_showroom() {
  local suffix=$1
  local city=$2
  local draft_id
  local call_now
  call_now=$(now_ns)
  local call_short="${call_now: -6}"
  local suffix_key
  suffix_key=$(printf '%s' "${suffix}" | tr -c '[:alnum:]' '_' | tr '[:upper:]' '[:lower:]')
  suffix_key="${suffix_key#_}"
  suffix_key="${suffix_key%_}"
  local unique="${call_short}_${suffix_key}"
  local name="Nt ${unique}"
  local instagram_suffix
  instagram_suffix=$(printf '%s' "${suffix}" | tr -c '[:alnum:]_.' '_' | tr '[:upper:]' '[:lower:]')
  instagram_suffix="${instagram_suffix#_}"
  instagram_suffix="${instagram_suffix%_}"
  local instagram_handle="notif_${call_short}_${instagram_suffix}"
  instagram_handle="${instagram_handle:0:30}"
  instagram_handle="${instagram_handle%.}"
  instagram_handle="${instagram_handle%_}"
  local lat="49.8397"
  local lng="24.0297"
  if [[ "$city" == "Kyiv" ]]; then
    lat="50.4501"
    lng="30.5234"
  fi

  http_request "POST /showrooms/draft (${suffix})" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/draft"

  draft_id=$(json_get "$LAST_BODY" '.data.showroom.id // empty')
  assert_non_empty "$draft_id" "draft showroom id (${suffix})"

  http_request "PATCH /showrooms/{id} (${suffix})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"name\":\"${name}\",\"type\":\"multibrand\",\"country\":\"Ukraine\",\"address\":\"${city}, Notif St ${unique}\",\"city\":\"${city}\",\"availability\":\"open\",\"brands\":[\"BrandNotif${call_short}\"],\"contacts\":{\"phone\":\"+380501112233\",\"instagram\":\"https://instagram.com/${instagram_handle}\"},\"location\":{\"lat\":${lat},\"lng\":${lng}}}" \
    "${BASE_URL}/showrooms/${draft_id}"

  http_request "PATCH /showrooms/{id} geo (${suffix})" 200 "" \
    -X PATCH "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d "{\"geo\":{\"city\":\"${city}\",\"country\":\"Ukraine\",\"coords\":{\"lat\":${lat},\"lng\":${lng}},\"placeId\":\"notif-place-${unique}\"}}" \
    "${BASE_URL}/showrooms/${draft_id}"

  http_request "POST /showrooms/{id}/submit (${suffix})" 200 "" \
    -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{}' \
    "${BASE_URL}/showrooms/${draft_id}/submit"

  echo "$draft_id"
}

approve_showroom() {
  local showroom_id=$1
  http_request "POST /admin/showrooms/{id}/approve (${showroom_id})" 200 "" \
    -X POST "${ADMIN_HEADER[@]}" \
    "${BASE_URL}/admin/showrooms/${showroom_id}/approve"
}

reject_showroom() {
  local showroom_id=$1
  http_request "POST /admin/showrooms/{id}/reject (${showroom_id})" 200 "" \
    -X POST "${ADMIN_HEADER[@]}" "${JSON_HEADER[@]}" \
    -d '{"reason":"notifications test reject"}' \
    "${BASE_URL}/admin/showrooms/${showroom_id}/reject"
}

assert_notification_exists() {
  local target_uid=$1
  local dedupe_key=$2
  local expected_type=$3
  local expected_resource_type=$4
  local expected_resource_id=$5
  local expected_actor_uid=${6:-}

  node --input-type=module - "$target_uid" "$dedupe_key" "$expected_type" "$expected_resource_type" "$expected_resource_id" "$expected_actor_uid" <<'NODE'
import { getFirestoreInstance } from "./src/config/firebase.js";

const [targetUid, dedupeKey, expectedType, expectedResourceType, expectedResourceId, expectedActorUid] = process.argv.slice(2);
const db = getFirestoreInstance();
const collectionRef = db.collection("users").doc(targetUid).collection("notifications");
const maxAttempts = Number(process.env.NOTIFICATION_ASSERT_MAX_ATTEMPTS || 8);
const delayMs = Number(process.env.NOTIFICATION_ASSERT_DELAY_MS || 250);

function matches(data = {}) {
    if (data.type !== expectedType) return false;
    if (!data.resource || data.resource.type !== expectedResourceType || data.resource.id !== expectedResourceId) {
        return false;
    }
    if (expectedActorUid && data.actorUid !== expectedActorUid) {
        return false;
    }
    return true;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let matched = null;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const exactSnap = await collectionRef.doc(dedupeKey).get();
    if (exactSnap.exists) {
        const data = exactSnap.data() || {};
        if (matches(data)) {
            matched = { id: exactSnap.id, ...data };
            break;
        }
    }

    const listSnap = await collectionRef.get();
    matched = listSnap.docs
        .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
        .find(data => matches(data)) ?? null;

    if (matched) break;
    if (attempt < maxAttempts) {
        await sleep(delayMs);
    }
}

if (!matched) {
    console.error(`missing notification ${dedupeKey}`);
    process.exit(1);
}

if (matched.isRead !== false || matched.readAt !== null) {
    console.error(`unexpected read state for ${matched.id}`);
    process.exit(1);
}

if (matched.dedupeKey !== matched.id) {
    console.error(`unexpected dedupe/doc id mismatch for ${matched.id}`);
    process.exit(1);
}
NODE
}

assert_notification_absent() {
  local target_uid=$1
  local dedupe_key=$2

  node --input-type=module - "$target_uid" "$dedupe_key" <<'NODE'
import { getFirestoreInstance } from "./src/config/firebase.js";

const [targetUid, dedupeKey] = process.argv.slice(2);
const db = getFirestoreInstance();
const ref = db.collection("users").doc(targetUid).collection("notifications").doc(dedupeKey);
const snap = await ref.get();
if (snap.exists) {
    console.error(`unexpected notification ${dedupeKey}`);
    process.exit(1);
}
NODE
}

assert_notification_count_by_dedupe() {
  local target_uid=$1
  local dedupe_key=$2
  local expected_count=$3

  node --input-type=module - "$target_uid" "$dedupe_key" "$expected_count" <<'NODE'
import { getFirestoreInstance } from "./src/config/firebase.js";

const [targetUid, dedupeKey, expectedCountRaw] = process.argv.slice(2);
const expectedCount = Number(expectedCountRaw);
const db = getFirestoreInstance();
const snap = await db
    .collection("users")
    .doc(targetUid)
    .collection("notifications")
    .where("dedupeKey", "==", dedupeKey)
    .get();
if (snap.size !== expectedCount) {
    console.error(`unexpected dedupe count for ${dedupeKey}: ${snap.size}`);
    process.exit(1);
}
NODE
}

seed_owned_event() {
  local event_id=$1
  local owner_uid=$2

  node --input-type=module - "$event_id" "$owner_uid" <<'NODE'
import { Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "./src/config/firebase.js";

const [eventId, ownerUid] = process.argv.slice(2);
const db = getFirestoreInstance();
const now = Date.now();
await db.collection("events").doc(eventId).set({
    name: `Notifications Event ${eventId}`,
    description: "Notifications storage test event",
    type: "pop_up",
    country: "Ukraine",
    city: "Kyiv",
    address: "Kyiv, Notifications 1",
    cityNormalized: "kyiv",
    externalUrl: "https://www.instagram.com/dim_brendiv/",
    startsAt: Timestamp.fromDate(new Date(now + (3 * 24 * 60 * 60 * 1000))),
    endsAt: Timestamp.fromDate(new Date(now + (3 * 24 * 60 * 60 * 1000))),
    published: true,
    ownerUid,
    createdAt: Timestamp.fromDate(new Date(now)),
    updatedAt: Timestamp.fromDate(new Date(now)),
}, { merge: true });
NODE
}

print_section "Setup identities"
ensure_owner_role
http_request "GET /users/me (owner)" 200 "" "${AUTH_HEADER[@]}" "${BASE_URL}/users/me"
USER_UID=$(json_get "$LAST_BODY" '.data.uid // empty')
assert_non_empty "$USER_UID" "owner uid"

http_request "GET /users/me (admin)" 200 "" "${ADMIN_HEADER[@]}" "${BASE_URL}/users/me"
ADMIN_UID=$(json_get "$LAST_BODY" '.data.uid // empty')
assert_non_empty "$ADMIN_UID" "admin uid"

print_section "Approve/reject notifications"
APPROVED_ID=$(create_submittable_showroom "notif-approved" "Kyiv" | tail -n1)
approve_showroom "$APPROVED_ID"
APPROVE_DEDUPE="showroom:${APPROVED_ID}:approved"
assert_notification_exists "$USER_UID" "$APPROVE_DEDUPE" "SHOWROOM_APPROVED" "showroom" "$APPROVED_ID" "$ADMIN_UID"

REJECTED_ID=$(create_submittable_showroom "notif-rejected" "Lviv" | tail -n1)
reject_showroom "$REJECTED_ID"
REJECT_DEDUPE="showroom:${REJECTED_ID}:rejected"
assert_notification_exists "$USER_UID" "$REJECT_DEDUPE" "SHOWROOM_REJECTED" "showroom" "$REJECTED_ID" "$ADMIN_UID"

print_section "Showroom favorite notifications"
http_request "POST /showrooms/{id}/favorite (admin first)" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"

SHOWROOM_FAV_DEDUPE="showroom:${APPROVED_ID}:favorited:${ADMIN_UID}"
if [[ "${MVP_MODE:-}" == "true" ]]; then
  assert_notification_absent "$USER_UID" "$SHOWROOM_FAV_DEDUPE"
else
  assert_notification_exists "$USER_UID" "$SHOWROOM_FAV_DEDUPE" "SHOWROOM_FAVORITED" "showroom" "$APPROVED_ID" "$ADMIN_UID"
  assert_notification_count_by_dedupe "$USER_UID" "$SHOWROOM_FAV_DEDUPE" "1"
fi

http_request "POST /showrooms/{id}/favorite (admin idempotent)" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"
if [[ "${MVP_MODE:-}" != "true" ]]; then
  assert_notification_count_by_dedupe "$USER_UID" "$SHOWROOM_FAV_DEDUPE" "1"
fi

http_request "POST /showrooms/{id}/favorite (self-like)" 200 "" \
  -X POST "${AUTH_HEADER[@]}" \
  "${BASE_URL}/showrooms/${APPROVED_ID}/favorite"

SELF_SHOWROOM_DEDUPE="showroom:${APPROVED_ID}:favorited:${USER_UID}"
assert_notification_absent "$USER_UID" "$SELF_SHOWROOM_DEDUPE"

print_section "Lookbook favorite notification"
http_request "POST /lookbooks/create (owner)" 201 "" \
  -X POST "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  -d "{\"imageUrl\":\"https://example.com/notifications-lookbook.jpg\",\"showroomId\":\"${APPROVED_ID}\",\"description\":\"Notifications lookbook\"}" \
  "${BASE_URL}/lookbooks/create"
LOOKBOOK_ID=$(json_get "$LAST_BODY" '.data.lookbook.id // empty')
assert_non_empty "$LOOKBOOK_ID" "lookbook id"

http_request "POST /lookbooks/{id}/favorite (admin first)" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/lookbooks/${LOOKBOOK_ID}/favorite"

LOOKBOOK_DEDUPE="lookbook:${LOOKBOOK_ID}:favorited:${ADMIN_UID}"
if [[ "${MVP_MODE:-}" == "true" ]]; then
  assert_notification_absent "$USER_UID" "$LOOKBOOK_DEDUPE"
else
  assert_notification_exists "$USER_UID" "$LOOKBOOK_DEDUPE" "LOOKBOOK_FAVORITED" "lookbook" "$LOOKBOOK_ID" "$ADMIN_UID"
fi

print_section "Event want-to-visit notification"
EVENT_ID="events_notif_${NOW}"
seed_owned_event "$EVENT_ID" "$USER_UID"
http_request "POST /events/{id}/want-to-visit (admin first)" 200 "" \
  -X POST "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/events/${EVENT_ID}/want-to-visit"

EVENT_DEDUPE="event:${EVENT_ID}:want:${ADMIN_UID}"
if [[ "${MVP_MODE:-}" == "true" ]]; then
  assert_notification_absent "$USER_UID" "$EVENT_DEDUPE"
else
  assert_notification_exists "$USER_UID" "$EVENT_DEDUPE" "EVENT_WANT_TO_VISIT" "event" "$EVENT_ID" "$ADMIN_UID"
fi

print_section "Admin delete showroom notification"
http_request "DELETE /admin/showrooms/{id}" 200 "" \
  -X DELETE "${ADMIN_HEADER[@]}" \
  "${BASE_URL}/admin/showrooms/${APPROVED_ID}"
DELETED_DEDUPE="showroom:${APPROVED_ID}:deleted_by_admin"
if [[ "${MVP_MODE:-}" == "true" ]]; then
  assert_notification_absent "$USER_UID" "$DELETED_DEDUPE"
else
  assert_notification_exists "$USER_UID" "$DELETED_DEDUPE" "SHOWROOM_DELETED_BY_ADMIN" "showroom" "$APPROVED_ID" "$ADMIN_UID"
fi

print_section "RESULT"
echo "✔ Notifications storage tests passed"
