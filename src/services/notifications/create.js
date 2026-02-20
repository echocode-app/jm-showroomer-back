import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest } from "../../core/error.js";
import { sendPushToUser } from "../push/send.js";
import { buildPushPayload } from "./payload.js";
import { assertValidNotificationType } from "./types.js";
import { isNotificationAlreadyExistsError } from "./dedupe.js";

// Purpose: Persist user notifications with idempotent doc ids.
// Responsibility: Firestore write + safe push dispatch handoff.
// Invariants:
// - dedupeKey is the notification document id
// - push must never break business flow
// - push is emitted only for non-transactional writes

const RESOURCE_TYPES = new Set(["showroom", "lookbook", "event"]);

export async function createNotification({
    targetUid,
    actorUid,
    type,
    resourceType,
    resourceId,
    payload = {},
    dedupeKey,
    tx = null,
}) {
    assertValidNotificationType(type);
    assertCreateParams({ targetUid, dedupeKey, resourceType, resourceId });

    const db = getFirestoreInstance();
    const ref = db
        .collection("users")
        .doc(targetUid)
        .collection("notifications")
        .doc(dedupeKey);

    const doc = {
        type,
        actorUid: actorUid || null,
        resource: {
            type: resourceType,
            id: resourceId,
        },
        payload: payload && typeof payload === "object" ? payload : {},
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
        isRead: false,
        dedupeKey,
    };

    if (tx) {
        // Guard: transaction callback can be retried by Firestore; skip side effects here.
        tx.set(ref, doc);
        return;
    }

    const created = await upsertNotificationDoc(ref, doc);
    if (!created) return;

    const pushPayload = buildPushPayload({
        type,
        resourceType,
        resourceId,
        notificationId: dedupeKey,
        payload: doc.payload,
    });
    await sendPushToUser(targetUid, pushPayload);
}

function assertCreateParams({ targetUid, dedupeKey, resourceType, resourceId }) {
    if (!targetUid || typeof targetUid !== "string") {
        throw badRequest("QUERY_INVALID");
    }
    if (!dedupeKey || typeof dedupeKey !== "string") {
        throw badRequest("QUERY_INVALID");
    }
    if (!resourceId || typeof resourceId !== "string") {
        throw badRequest("QUERY_INVALID");
    }
    if (!RESOURCE_TYPES.has(resourceType)) {
        throw badRequest("QUERY_INVALID");
    }
}

async function upsertNotificationDoc(ref, doc) {
    try {
        await ref.create(doc);
        return true;
    } catch (err) {
        if (!isNotificationAlreadyExistsError(err)) {
            throw err;
        }
    }

    // Keep storage semantics backward compatible (existing dedupe doc is refreshed).
    await ref.set(doc, { merge: true });
    // Guard: prevent duplicate push delivery on dedupe-key collisions.
    return false;
}
