import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, notFound } from "../../core/error.js";

const CURSOR_VERSION = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
    const ref = notificationsCollection(uid).doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw notFound("NOTIFICATION_NOT_FOUND");
    }

    const data = snap.data() || {};
    if (data.isRead === true) {
        return { id: notificationId, isRead: true };
    }

    await ref.set(
        {
            isRead: true,
            readAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    return { id: notificationId, isRead: true };
}

export async function getUnreadNotificationsCount(uid) {
    const query = notificationsCollection(uid).where("isRead", "==", false);
    const aggregate = await query.count().get();
    return Number(aggregate.data().count || 0);
}

function notificationsCollection(uid) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("notifications");
}

function parseLimit(value) {
    if (value === undefined || value === null || value === "") return DEFAULT_LIMIT;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw badRequest("QUERY_INVALID");
    }
    const integer = Math.trunc(parsed);
    return Math.min(Math.max(integer || DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function decodeCursor(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        if (
            !parsed ||
            parsed.v !== CURSOR_VERSION ||
            typeof parsed.createdAt !== "string" ||
            !parsed.createdAt ||
            typeof parsed.id !== "string" ||
            !parsed.id
        ) {
            throw badRequest("CURSOR_INVALID");
        }

        const date = new Date(parsed.createdAt);
        if (Number.isNaN(date.getTime())) {
            throw badRequest("CURSOR_INVALID");
        }

        return {
            createdAtTs: Timestamp.fromDate(date),
            id: parsed.id,
        };
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}

function encodeCursor(doc) {
    const createdAtIso = toISO(doc.get("createdAt"));
    if (!createdAtIso) {
        throw badRequest("CURSOR_INVALID");
    }

    return Buffer.from(
        JSON.stringify({
            v: CURSOR_VERSION,
            createdAt: createdAtIso,
            id: doc.id,
        })
    ).toString("base64");
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

function toISO(ts) {
    if (!ts) return null;
    if (typeof ts === "string") return ts;
    if (typeof ts?.toDate === "function") return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    return null;
}
