import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest } from "../../core/error.js";
import { assertValidNotificationType } from "./types.js";

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
        tx.set(ref, doc);
        return;
    }

    await ref.set(doc);
}
