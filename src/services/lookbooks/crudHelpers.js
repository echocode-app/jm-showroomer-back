import { Timestamp } from "firebase-admin/firestore";
import { badRequest, forbidden } from "../../core/error.js";
import { getFirestoreInstance } from "../../config/firebase.js";

const LIKE_DELETE_BATCH_LIMIT = 500;

// Update/delete is allowed only for the actor that created the lookbook.
export function assertCanManageLookbook(lookbook, actor) {
    const byUserId = actor.userId && lookbook.authorId && lookbook.authorId === actor.userId;
    const byAnonymousId = actor.anonymousId && lookbook.anonymousId && lookbook.anonymousId === actor.anonymousId;

    if (!byUserId && !byAnonymousId) {
        throw forbidden("LOOKBOOK_FORBIDDEN");
    }
}

// Public readers see only published records; owners can see own drafts.
export function canReadLookbook(lookbook, actor) {
    if (lookbook.published === true) return true;

    const byUserId = actor?.userId && lookbook.authorId && lookbook.authorId === actor.userId;
    const byAnonymousId = actor?.anonymousId && lookbook.anonymousId && lookbook.anonymousId === actor.anonymousId;

    return Boolean(byUserId || byAnonymousId);
}

// CRUD cursor uses plain document id, validated as non-empty string.
export function parseCursor(value) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") {
        throw badRequest("CURSOR_INVALID");
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw badRequest("CURSOR_INVALID");
    }
    return trimmed;
}

// Shared safe string parser for optional text fields.
export function parseOptionalString(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
}

// Coerce unknown date-like values to Firestore Timestamp where possible.
export function toTimestamp(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Timestamp.fromDate(date);
}

// Canonical path for lookbook like documents keyed by actor identity.
export function likeDocRef(lookbookId, actor, db) {
    return db
        .collection("lookbooks")
        .doc(lookbookId)
        .collection("likes")
        .doc(actor.likeWriteKey ?? actor.actorKey);
}

// Detail endpoint helper to resolve liked state across compatible key variants.
export async function isLikedByActor(lookbookId, actor, db) {
    if (!actor) return false;
    const refs = (actor.likeReadKeys ?? [actor.likeWriteKey ?? actor.actorKey])
        .map(key => db.collection("lookbooks").doc(lookbookId).collection("likes").doc(key));
    const snaps = await db.getAll(...refs);
    return snaps.some(snap => snap.exists);
}

// Batch helper for list endpoint to avoid per-item like lookups.
export async function getLikedIdsForActor(ids, actor, db) {
    if (!actor || ids.length === 0) return new Set();
    const keys = actor.likeReadKeys ?? [actor.likeWriteKey ?? actor.actorKey];
    const refs = [];
    const refToId = [];
    ids.forEach(id => {
        keys.forEach(key => {
            refs.push(db.collection("lookbooks").doc(id).collection("likes").doc(key));
            refToId.push(id);
        });
    });
    const snaps = await db.getAll(...refs);
    const liked = new Set();
    snaps.forEach((snap, idx) => {
        if (snap.exists) liked.add(refToId[idx]);
    });
    return liked;
}

// Cascading cleanup for likes subcollection before deleting a lookbook document.
export async function deleteLikesSubcollection(lookbookRef, db) {
    let deletedLikesCount = 0;
    while (true) {
        const likesSnap = await lookbookRef.collection("likes").limit(LIKE_DELETE_BATCH_LIMIT).get();
        if (likesSnap.empty) break;

        const batch = db.batch();
        likesSnap.docs.forEach(doc => batch.delete(doc.ref));
        try {
            await batch.commit();
            deletedLikesCount += likesSnap.docs.length;
        } catch (err) {
            err.meta = {
                ...(err?.meta && typeof err.meta === "object" ? err.meta : {}),
                deletedLikesCount,
                failedBatchSize: likesSnap.docs.length,
            };
            throw err;
        }
    }
    return { deletedLikesCount };
}

// Auth mirror projection used by favorites collection endpoints.
export function userFavoritesCollection(uid) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("lookbooks_favorites");
}

// Normalize author payload into optional card metadata.
export function normalizeAuthor(value) {
    if (!value || typeof value !== "object") {
        return null;
    }

    const name = parseOptionalString(value.name);
    if (!name) {
        return null;
    }

    return {
        name,
        position: parseOptionalString(value.position),
        instagram: parseOptionalString(value.instagram),
    };
}

// Normalize tagged outfit items and drop invalid records.
export function normalizeItems(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(item => {
            if (!item || typeof item !== "object") return null;

            const name = parseOptionalString(item.name);
            const link = parseOptionalString(item.link);
            if (!name || !link) return null;

            return { name, link };
        })
        .filter(Boolean);
}
