import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { notFound } from "../../core/error.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { decodeCursor, encodeCursor, parseLimit, toISO } from "./utils.js";

// Purpose: Read/update user notifications state.
// Responsibility: list, mark-as-read, unread counters.
// Invariant: reads are scoped to users/{uid}/notifications.

// =========================
// SECTION: Read Operations
// =========================

export async function listUserNotifications(uid, filters = {}) {
    const limit = parseLimit(filters.limit);
    const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;

    let query = notificationsCollection(uid)
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc")
        .limit(limit + 1);

    if (cursor) {
        query = query.startAfter(cursor.createdAtTs, cursor.id);
    }

    const snap = await query.get();
    const docs = snap.docs;
    const hasMore = docs.length > limit;
    const pageDocs = docs.slice(0, limit);
    const nextCursor = hasMore ? encodeCursor(pageDocs[pageDocs.length - 1]) : null;

    return {
        items: pageDocs.map(toNotificationItem),
        meta: {
            nextCursor,
            hasMore,
        },
    };
}

export async function markNotificationRead(uid, notificationId) {
    const db = getFirestoreInstance();
    const ref = notificationsCollection(uid).doc(notificationId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw notFound("NOTIFICATION_NOT_FOUND");
        }

        const data = snap.data() || {};
        if (data.isRead === true) {
            return;
        }

        tx.set(
            ref,
            {
                isRead: true,
                readAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    });

    return { id: notificationId, isRead: true };
}

export async function getUnreadNotificationsCount(uid) {
    const query = notificationsCollection(uid).where("isRead", "==", false);
    const aggregate = await query.count().get();
    return Number(aggregate.data().count || 0);
}

// =========================
// SECTION: Helpers
// =========================

function notificationsCollection(uid) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("notifications");
}

function toNotificationItem(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        type: data.type ?? null,
        actorUid: data.actorUid ?? null,
        resource: data.resource ?? null,
        payload: data.payload ?? {},
        createdAt: toISO(data.createdAt),
        isRead: data.isRead === true,
        readAt: toISO(data.readAt),
        dedupeKey: data.dedupeKey ?? doc.id,
    };
}
