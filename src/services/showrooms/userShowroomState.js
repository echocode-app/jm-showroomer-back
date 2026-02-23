import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { log } from "../../config/logger.js";
import { getFirestoreInstance } from "../../config/firebase.js";
import { notFound, badRequest } from "../../core/error.js";
import { createNotification } from "../notifications/notificationService.js";
import { NOTIFICATION_TYPES } from "../notifications/types.js";
import { shouldNotifyActorAction } from "../notifications/selfAction.js";
import { assertUserWritable, assertUserWritableInTx } from "../users/writeGuardService.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { parseStrictLimit } from "../../utils/pagination.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const CURSOR_VERSION = 1;
const SYNC_MAX_IDS = 100;
const IDS_CHUNK = 100;

export async function assertShowroomFavoriteable(showroomId) {
    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === showroomId);
        if (!showroom || showroom.status !== "approved" || showroom.status === "deleted") {
            throw notFound("SHOWROOM_NOT_FOUND");
        }
        return showroom;
    }

    const snap = await getFirestoreInstance()
        .collection("showrooms")
        .doc(showroomId)
        .get();

    const showroom = snap.exists ? snap.data() : null;
    // Anti-leak rule: all non-favoritable states map to the same 404 response.
    if (!showroom || showroom.status !== "approved" || showroom.status === "deleted") {
        throw notFound("SHOWROOM_NOT_FOUND");
    }

    return { id: snap.id, ...showroom };
}

export async function favoriteShowroom(uid, showroomId) {
    if (useDevMock) {
        const showroom = await assertShowroomFavoriteable(showroomId);

        const favoriteRef = userFavoritesCollection(uid).doc(showroomId);
        const favoriteSnap = await favoriteRef.get();
        if (favoriteSnap.exists) {
            return { applied: false };
        }

        await favoriteRef.set({ createdAt: FieldValue.serverTimestamp() });
        await tryCreateShowroomFavoriteNotification({
            showroom,
            showroomId,
            actorUid: uid,
        });
        return { applied: true };
    }

    const db = getFirestoreInstance();
    const showroomRef = db.collection("showrooms").doc(showroomId);
    const favoriteRef = userFavoritesCollection(uid).doc(showroomId);
    let applied = false;
    let showroomForNotification = null;

    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        const showroomSnap = await tx.get(showroomRef);
        const showroom = showroomSnap.exists ? showroomSnap.data() : null;
        // Anti-leak rule: all non-favoritable states map to the same 404 response.
        if (!showroom || showroom.status !== "approved" || showroom.status === "deleted") {
            throw notFound("SHOWROOM_NOT_FOUND");
        }
        showroomForNotification = {
            ownerUid: showroom.ownerUid ?? null,
            name: showroom.name ?? null,
        };

        const favoriteSnap = await tx.get(favoriteRef);
        if (favoriteSnap.exists) return;
        tx.set(favoriteRef, { createdAt: FieldValue.serverTimestamp() });
        applied = true;
    });

    if (applied) {
        await tryCreateShowroomFavoriteNotification({
            showroom: showroomForNotification,
            showroomId,
            actorUid: uid,
        });
    }

    return { applied };
}

export async function unfavoriteShowroom(uid, showroomId) {
    if (useDevMock) {
        const favoriteRef = userFavoritesCollection(uid).doc(showroomId);
        const favoriteSnap = await favoriteRef.get();
        if (!favoriteSnap.exists) {
            return { removed: false };
        }
        await favoriteRef.delete();
        return { removed: true };
    }

    const db = getFirestoreInstance();
    const favoriteRef = userFavoritesCollection(uid).doc(showroomId);
    let removed = false;

    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        const favoriteSnap = await tx.get(favoriteRef);
        if (!favoriteSnap.exists) return;
        tx.delete(favoriteRef);
        removed = true;
    });

    return { removed };
}

export async function syncGuestShowroomFavorites(uid, payload = {}) {
    await assertUserWritable(uid);
    const { favoriteIds } = parseSyncPayload(payload);

    if (favoriteIds.length === 0) {
        return {
            applied: { favorites: [] },
            skipped: [],
        };
    }

    const showroomsById = await getShowroomsByIds(favoriteIds);
    const allowed = [];
    const skipped = [];

    // Keep anti-leak behavior: all non-favoritable states are treated as skipped ids.
    for (const id of favoriteIds) {
        const showroom = showroomsById.get(id);
        if (!showroom || showroom.status !== "approved" || showroom.status === "deleted") {
            skipped.push(id);
            continue;
        }
        allowed.push(id);
    }

    await applyFavoritesBatch(uid, allowed);

    return {
        applied: { favorites: allowed },
        skipped,
    };
}

export async function listFavoriteShowrooms(uid, filters = {}) {
    const { limit, cursor } = parseCollectionFilters(filters);
    // Fetch one extra doc to determine hasMore without a second query.
    const pageSize = limit + 1;

    let query = userFavoritesCollection(uid)
        .orderBy("createdAt", "desc")
        .limit(pageSize);

    if (cursor) {
        query = query.startAfter(cursor.createdAtTs);
    }

    const snap = await query.get();
    const docs = snap.docs;
    const hasMore = docs.length > limit;
    const pageDocs = docs.slice(0, limit);
    const nextCursor = hasMore ? encodeCursor(pageDocs[pageDocs.length - 1]) : null;

    const showroomIds = pageDocs.map(doc => doc.id);
    const showrooms = showroomIds.length > 0
        ? await getApprovedShowroomsByIds(showroomIds)
        : [];

    return {
        items: showrooms,
        meta: {
            hasMore,
            nextCursor,
        },
    };
}

async function getApprovedShowroomsByIds(ids) {
    if (useDevMock) {
        // Keep DEV behavior aligned with mock showroom writes (no Firestore read in NODE_ENV=dev).
        const byId = new Map();
        DEV_STORE.showrooms.forEach(showroom => {
            if (!showroom || showroom.status !== "approved" || showroom.status === "deleted") {
                return;
            }
            byId.set(showroom.id, { ...showroom });
        });

        return ids
            .map(id => byId.get(id))
            .filter(Boolean);
    }

    const db = getFirestoreInstance();
    const refs = ids.map(id => db.collection("showrooms").doc(id));
    const snaps = await db.getAll(...refs);
    const byId = new Map();

    snaps.forEach(snap => {
        if (!snap.exists) return;
        const showroom = snap.data();
        if (!showroom || showroom.status !== "approved" || showroom.status === "deleted") {
            return;
        }
        byId.set(snap.id, { id: snap.id, ...showroom });
    });

    return ids
        .map(id => byId.get(id))
        .filter(Boolean);
}

async function getShowroomsByIds(ids) {
    if (useDevMock) {
        const byId = new Map();
        DEV_STORE.showrooms.forEach(showroom => {
            if (!showroom) return;
            byId.set(showroom.id, { ...showroom });
        });
        return byId;
    }

    const db = getFirestoreInstance();
    const refs = ids.map(id => db.collection("showrooms").doc(id));
    const byId = new Map();

    for (let i = 0; i < refs.length; i += IDS_CHUNK) {
        const chunk = refs.slice(i, i + IDS_CHUNK);
        const snaps = await db.getAll(...chunk);
        snaps.forEach(snap => {
            if (snap.exists) {
                byId.set(snap.id, { id: snap.id, ...snap.data() });
            }
        });
    }

    return byId;
}

async function applyFavoritesBatch(uid, favoriteIds) {
    if (favoriteIds.length === 0) return;

    const db = getFirestoreInstance();
    const createdAt = Timestamp.fromDate(new Date());
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        // Upsert keeps guest-sync idempotent across repeated client retries.
        for (const showroomId of favoriteIds) {
            const ref = userFavoritesCollection(uid).doc(showroomId);
            tx.set(ref, { createdAt }, { merge: true });
        }
    });
}

function userFavoritesCollection(uid) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("showrooms_favorites");
}

async function tryCreateShowroomFavoriteNotification({ showroom, showroomId, actorUid }) {
    const ownerUid = showroom?.ownerUid;
    // Guard: self-favorite should not produce notifications/push.
    if (!shouldNotifyActorAction(ownerUid, actorUid)) return;

    try {
        await createNotification({
            targetUid: ownerUid,
            actorUid,
            type: NOTIFICATION_TYPES.SHOWROOM_FAVORITED,
            resourceType: "showroom",
            resourceId: showroomId,
            payload: {
                showroomName: showroom?.name ?? null,
            },
            dedupeKey: `showroom:${showroomId}:favorited:${actorUid}`,
        });
    } catch (err) {
        log.error(
            `Notification write skipped (showroom favorite ${showroomId}): ${err?.message || err}`
        );
    }
}

function parseCollectionFilters(filters = {}) {
    return {
        limit: parseLimit(filters.limit),
        cursor: filters.cursor ? decodeCursor(filters.cursor) : null,
    };
}

function parseSyncPayload(payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw badRequest("QUERY_INVALID");
    }

    const allowedKeys = new Set(["favoriteIds"]);
    const unknownKeys = Object.keys(payload).filter(key => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
        throw badRequest("QUERY_INVALID");
    }

    return {
        favoriteIds: parseIdsList(payload.favoriteIds),
    };
}

function parseLimit(value) {
    return parseStrictLimit(value, {
        defaultValue: DEFAULT_LIMIT,
        maxValue: MAX_LIMIT,
        errorCode: "QUERY_INVALID",
    });
}

function parseIdsList(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw badRequest("QUERY_INVALID");
    }
    if (value.length > SYNC_MAX_IDS) {
        throw badRequest("SHOWROOM_SYNC_LIMIT_EXCEEDED");
    }

    const normalized = [];
    const seen = new Set();

    for (const raw of value) {
        if (typeof raw !== "string") {
            throw badRequest("QUERY_INVALID");
        }
        const id = raw.trim();
        if (!id) {
            throw badRequest("QUERY_INVALID");
        }
        if (!seen.has(id)) {
            normalized.push(id);
            seen.add(id);
        }
    }

    return normalized;
}

function decodeCursor(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        if (
            !parsed ||
            parsed.v !== CURSOR_VERSION ||
            typeof parsed.createdAt !== "string" ||
            !parsed.createdAt
        ) {
            throw badRequest("QUERY_INVALID");
        }

        const ms = Date.parse(parsed.createdAt);
        if (!Number.isFinite(ms)) {
            throw badRequest("QUERY_INVALID");
        }

        return {
            createdAtIso: new Date(ms).toISOString(),
            // Query ordering is based on Firestore Timestamp createdAt.
            createdAtTs: Timestamp.fromDate(new Date(ms)),
        };
    } catch {
        throw badRequest("QUERY_INVALID");
    }
}

function encodeCursor(doc) {
    if (!doc) return null;
    const createdAt = doc.get("createdAt");
    if (!createdAt || typeof createdAt.toDate !== "function") return null;

    return Buffer.from(JSON.stringify({
        v: CURSOR_VERSION,
        createdAt: createdAt.toDate().toISOString(),
        id: doc.id,
    })).toString("base64");
}
