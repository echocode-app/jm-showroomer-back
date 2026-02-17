import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, notFound } from "../../core/error.js";
import { parseLimit } from "./parse.js";
import { getLookbooksCollection } from "./firestoreQuery.js";
import { normalizeLookbook } from "./response.js";
import {
    assertCanManageLookbook,
    canReadLookbook,
    deleteLikesSubcollection,
    getLikedIdsForActor,
    isLikedByActor,
    likeDocRef,
    normalizeAuthor,
    normalizeItems,
    parseCursor,
    parseOptionalString,
    toTimestamp,
    userFavoritesCollection,
} from "./crudHelpers.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Creates a lookbook owned either by authenticated user or guest actor.
export async function createLookbookService(payload, actor) {
    await assertShowroomExists(payload.showroomId);

    const now = Timestamp.fromDate(new Date());
    const ref = getLookbooksCollection().doc();

    const doc = {
        imageUrl: payload.imageUrl,
        showroomId: payload.showroomId,
        description: payload.description ?? null,
        // Optional UI card metadata (MVP1-compatible): author block + tagged items.
        author: normalizeAuthor(payload.author),
        items: normalizeItems(payload.items),
        authorId: actor.isAnonymous ? null : actor.userId,
        anonymousId: actor.isAnonymous ? actor.anonymousId : null,
        likesCount: 0,
        published: true,
        createdAt: now,
        updatedAt: now,
    };

    await ref.set(doc);
    return normalizeLookbook({ id: ref.id, ...doc });
}

// Public-compatible list endpoint with actor-aware `likedByMe` projection.
export async function listLookbooksCrudService(filters = {}, actor = null) {
    const limit = parseLimit(filters.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = parseCursor(filters.cursor);
    const showroomId = parseOptionalString(filters.showroomId);

    const db = getFirestoreInstance();
    let query = getLookbooksCollection()
        .where("published", "==", true)
        // Stable ordering for cursor pagination in default mode.
        .orderBy("createdAt", "desc")
        .orderBy("__name__", "desc")
        .limit(limit + 1);

    if (showroomId) {
        query = query.where("showroomId", "==", showroomId);
    }

    if (cursor) {
        const cursorDoc = await getLookbooksCollection().doc(cursor).get();
        if (!cursorDoc.exists) {
            throw badRequest("CURSOR_INVALID");
        }
        const createdAt = toTimestamp(cursorDoc.get("createdAt"));
        if (!createdAt) {
            throw badRequest("CURSOR_INVALID");
        }
        query = query.startAfter(createdAt, cursorDoc.id);
    }

    const snap = await query.get();
    const docs = snap.docs;
    const hasMore = docs.length > limit;
    const page = docs.slice(0, limit);

    const items = page.map(doc => normalizeLookbook({ id: doc.id, ...doc.data() }));
    const likedIds = await getLikedIdsForActor(items.map(item => item.id), actor, db);
    const lookbooks = items.map(item => ({
        ...item,
        likedByMe: likedIds.has(item.id),
    }));

    return {
        lookbooks,
        meta: {
            hasMore,
            nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
            paging: hasMore ? "enabled" : "end",
        },
    };
}

// Detail endpoint with ownership visibility guard for unpublished records.
export async function getLookbookByIdCrudService(id, actor = null) {
    const snap = await getLookbooksCollection().doc(id).get();
    if (!snap.exists) {
        throw notFound("LOOKBOOK_NOT_FOUND");
    }

    const lookbook = normalizeLookbook({ id: snap.id, ...snap.data() });
    if (!canReadLookbook(lookbook, actor)) {
        throw notFound("LOOKBOOK_NOT_FOUND");
    }

    const db = getFirestoreInstance();
    const likedByMe = await isLikedByActor(id, actor, db);

    return {
        ...lookbook,
        likedByMe,
    };
}

// Owner-only update with transaction for permission and integrity checks.
export async function updateLookbookService(id, payload, actor) {
    const db = getFirestoreInstance();
    const ref = getLookbooksCollection().doc(id);

    await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw notFound("LOOKBOOK_NOT_FOUND");

        const lookbook = normalizeLookbook({ id: snap.id, ...snap.data() });
        assertCanManageLookbook(lookbook, actor);

        if (payload.showroomId && payload.showroomId !== lookbook.showroomId) {
            await assertShowroomExists(payload.showroomId);
        }

        const patch = {
            updatedAt: Timestamp.fromDate(new Date()),
        };
        if (payload.imageUrl !== undefined) patch.imageUrl = payload.imageUrl;
        if (payload.showroomId !== undefined) patch.showroomId = payload.showroomId;
        if (payload.description !== undefined) patch.description = payload.description;
        if (payload.author !== undefined) patch.author = normalizeAuthor(payload.author);
        if (payload.items !== undefined) patch.items = normalizeItems(payload.items);

        tx.set(ref, patch, { merge: true });
    });

    return getLookbookByIdCrudService(id, actor);
}

// Owner-only delete with cascading likes cleanup.
export async function deleteLookbookService(id, actor) {
    const db = getFirestoreInstance();
    const ref = getLookbooksCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
        throw notFound("LOOKBOOK_NOT_FOUND");
    }

    const lookbook = normalizeLookbook({ id: snap.id, ...snap.data() });
    assertCanManageLookbook(lookbook, actor);

    await deleteLikesSubcollection(ref, db);
    await ref.delete();

    return { id, status: "deleted" };
}

// Idempotent favorite add with canonical like doc and atomic counter update.
export async function likeLookbookService(id, actor) {
    const db = getFirestoreInstance();
    const ref = getLookbooksCollection().doc(id);
    const likeRef = likeDocRef(id, actor, db);
    const readLikeRefs = (actor.likeReadKeys ?? [actor.likeWriteKey ?? actor.actorKey])
        .map(key => db.collection("lookbooks").doc(id).collection("likes").doc(key));
    const now = Timestamp.fromDate(new Date());
    let applied = false;

    await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw notFound("LOOKBOOK_NOT_FOUND");

        const lookbook = normalizeLookbook({ id: snap.id, ...snap.data() });
        if (!canReadLookbook(lookbook, actor)) {
            throw notFound("LOOKBOOK_NOT_FOUND");
        }

        const likeSnaps = await Promise.all(readLikeRefs.map(likeReadRef => tx.get(likeReadRef)));
        const hasLike = likeSnaps.some(likeSnap => likeSnap.exists);
        if (hasLike) {
            // Canonicalize legacy key layout without touching counters.
            if (!likeSnaps[0]?.exists) {
                tx.set(likeRef, {
                    createdAt: now,
                    actorType: actor.isAnonymous ? "anonymous" : "user",
                    actorId: actor.isAnonymous ? actor.anonymousId : actor.userId,
                }, { merge: true });
            }
            return;
        }

        tx.set(likeRef, {
            createdAt: now,
            actorType: actor.isAnonymous ? "anonymous" : "user",
            actorId: actor.isAnonymous ? actor.anonymousId : actor.userId,
        });
        tx.set(ref, {
            likesCount: FieldValue.increment(1),
            updatedAt: now,
        }, { merge: true });
        applied = true;
    });

    if (applied && !actor.isAnonymous && actor.userId) {
        await userFavoritesCollection(actor.userId).doc(id).set({ createdAt: now }, { merge: true });
    }

    return { status: "favorited" };
}

// Idempotent favorite remove with canonical cleanup and guarded counter decrement.
export async function unlikeLookbookService(id, actor) {
    const db = getFirestoreInstance();
    const ref = getLookbooksCollection().doc(id);
    const likeRef = likeDocRef(id, actor, db);
    const readLikeRefs = (actor.likeReadKeys ?? [actor.likeWriteKey ?? actor.actorKey])
        .map(key => db.collection("lookbooks").doc(id).collection("likes").doc(key));
    const now = Timestamp.fromDate(new Date());
    let removed = false;

    await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw notFound("LOOKBOOK_NOT_FOUND");

        const likeSnaps = await Promise.all(readLikeRefs.map(likeReadRef => tx.get(likeReadRef)));
        const existingRefs = likeSnaps
            .map((likeSnap, idx) => ({ likeSnap, ref: readLikeRefs[idx] }))
            .filter(item => item.likeSnap.exists)
            .map(item => item.ref);
        if (existingRefs.length === 0) {
            return;
        }

        const current = Number(snap.get("likesCount")) || 0;
        existingRefs.forEach(existingRef => tx.delete(existingRef));
        // Ensure canonical key is removed as well (if not in read set for any reason).
        tx.delete(likeRef);
        tx.set(ref, {
            likesCount: Math.max(0, current - 1),
            updatedAt: now,
        }, { merge: true });
        removed = true;
    });

    if (removed && !actor.isAnonymous && actor.userId) {
        await userFavoritesCollection(actor.userId).doc(id).delete();
    }

    return { status: "removed" };
}

// Ensures lookbook always references an existing non-deleted showroom.
async function assertShowroomExists(showroomId) {
    const id = parseOptionalString(showroomId);
    if (!id) throw badRequest("SHOWROOM_ID_INVALID");

    const snap = await getFirestoreInstance().collection("showrooms").doc(id).get();
    const showroom = snap.exists ? snap.data() : null;
    if (!showroom || showroom.status === "deleted") {
        throw badRequest("SHOWROOM_ID_INVALID");
    }
}
