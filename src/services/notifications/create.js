import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { log } from "../../config/logger.js";
import { badRequest } from "../../core/error.js";
import { sendPushToUser } from "../push/send.js";
import { buildPushPayload } from "./payload.js";
import { isNotificationTypeEnabled } from "./policy.js";
import { assertValidNotificationType } from "./types.js";
import { isNotificationAlreadyExistsError } from "./dedupe.js";
import { sanitizeNotificationPayload } from "./payloadValidation.js";

// Purpose: Persist user notifications with idempotent doc ids.
// Responsibility: Firestore write + safe push dispatch handoff.
// Invariants:
// - dedupeKey is the notification document id
// - push must never break business flow
// - push is emitted only for non-transactional writes
// - deleted targets are skipped in both tx and non-tx modes

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
    if (!isNotificationTypeEnabled(type)) {
        return {
            skippedByPolicy: true,
            created: false,
            pushed: false,
        };
    }

    const db = getFirestoreInstance();
    const userRef = db.collection("users").doc(targetUid);
    const userSnap = tx ? await tx.get(userRef) : await userRef.get();
    const targetUser = userSnap.exists ? (userSnap.data() || {}) : null;
    if (!targetUser || targetUser.isDeleted === true) {
        return {
            skippedByTargetState: true,
            created: false,
            pushed: false,
        };
    }
    const ref = db
        .collection("users")
        .doc(targetUid)
        .collection("notifications")
        .doc(dedupeKey);

    const sanitizedPayload = sanitizeNotificationPayload(type, payload);

    const doc = {
        type,
        actorUid: actorUid || null,
        resource: {
            type: resourceType,
            id: resourceId,
        },
        payload: sanitizedPayload,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
        isRead: false,
        dedupeKey,
    };

    if (tx) {
        // Guard: transaction callback can be retried by Firestore; skip side effects here.
        tx.set(ref, doc);
        return {
            skippedByPolicy: false,
            created: false,
            pushed: false,
            transactionWrite: true,
        };
    }

    const created = await upsertNotificationDoc(ref, doc);
    if (!created) {
        log.info(
            `Notification deduped targetUid=${targetUid} type=${type} resourceType=${resourceType} resourceId=${resourceId} dedupeKey=${dedupeKey}`
        );
        return {
            skippedByPolicy: false,
            created: false,
            pushed: false,
            deduped: true,
        };
    }

    const pushPayload = buildPushPayload({
        type,
        resourceType,
        resourceId,
        notificationId: dedupeKey,
        payload: doc.payload,
        locale: targetUser?.appLanguage ?? null,
    });
    const pushResult = await sendPushToUser(targetUid, pushPayload);
    log.info(
        `Notification created targetUid=${targetUid} type=${type} resourceType=${resourceType} resourceId=${resourceId} dedupeKey=${dedupeKey} push=${JSON.stringify(pushResult)}`
    );
    return {
        skippedByPolicy: false,
        created: true,
        pushed: pushResult?.skipped !== true,
    };
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

    const existingSnap = await ref.get();
    const existing = existingSnap.exists ? existingSnap.data() : null;
    if (!isCompatibleDedupeCollision(existing, doc)) {
        log.error(
            `Notification dedupe collision skipped path=${ref.path} existingType=${existing?.type || "unknown"} incomingType=${doc.type}`
        );
        // Guard: never overwrite a dedupe doc that belongs to a different notification identity.
        return false;
    }

    // Keep storage semantics backward compatible (existing dedupe doc is refreshed).
    await ref.set(doc, { merge: true });
    // Guard: prevent duplicate push delivery on dedupe-key collisions.
    return false;
}

function isCompatibleDedupeCollision(existing, incoming) {
    if (!existing || typeof existing !== "object") return true;
    if (existing.type && existing.type !== incoming.type) return false;
    const existingActor = existing.actorUid ?? null;
    const incomingActor = incoming.actorUid ?? null;
    if (existingActor && existingActor !== incomingActor) return false;
    const existingResourceType = existing.resource?.type ?? null;
    const incomingResourceType = incoming.resource?.type ?? null;
    if (existingResourceType && existingResourceType !== incomingResourceType) return false;
    const existingResourceId = existing.resource?.id ?? null;
    const incomingResourceId = incoming.resource?.id ?? null;
    if (existingResourceId && existingResourceId !== incomingResourceId) return false;
    return true;
}
