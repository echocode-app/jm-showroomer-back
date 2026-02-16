import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { getLookbooksCollection } from "./firestoreQuery.js";
import { parseSyncPayload } from "./parse.js";
import { normalizeLookbook } from "./response.js";

const IDS_CHUNK = 100;

export async function syncGuestLookbookFavorites(uid, payload = {}) {
    const { favoriteIds } = parseSyncPayload(payload);

    if (favoriteIds.length === 0) {
        return {
            applied: { favorites: [] },
            skipped: [],
        };
    }

    const lookbooksById = await getLookbooksByIds(favoriteIds);
    const allowed = [];
    const skipped = [];

    for (const id of favoriteIds) {
        const lookbook = lookbooksById.get(id);
        if (!lookbook || lookbook.published !== true) {
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

async function getLookbooksByIds(ids) {
    const db = getFirestoreInstance();
    const refs = ids.map(id => getLookbooksCollection().doc(id));
    const result = new Map();

    // Fetch in chunks to stay within Firestore getAll limits.
    for (let i = 0; i < refs.length; i += IDS_CHUNK) {
        const chunk = refs.slice(i, i + IDS_CHUNK);
        const snaps = await db.getAll(...chunk);

        snaps.forEach(snap => {
            if (snap.exists) {
                result.set(snap.id, normalizeLookbook({ id: snap.id, ...snap.data() }));
            }
        });
    }

    return result;
}

async function applyFavoritesBatch(uid, favoriteIds) {
    if (favoriteIds.length === 0) return;

    const db = getFirestoreInstance();
    const batch = db.batch();
    const createdAt = Timestamp.fromDate(new Date());
    const actorKeys = [`u:${uid}`, uid];

    // Keep canonical likes and mirror favorites consistent.
    for (const lookbookId of favoriteIds) {
        const lookbookRef = getLookbooksCollection().doc(lookbookId);
        const canonicalLikeRef = lookbookRef.collection("likes").doc(actorKeys[0]);
        const legacyLikeRef = lookbookRef.collection("likes").doc(actorKeys[1]);

        await db.runTransaction(async tx => {
            const lookbookSnap = await tx.get(lookbookRef);
            if (!lookbookSnap.exists) return;

            const canonicalSnap = await tx.get(canonicalLikeRef);
            const legacySnap = await tx.get(legacyLikeRef);
            const hasLike = canonicalSnap.exists || legacySnap.exists;

            if (!hasLike) {
                tx.set(canonicalLikeRef, {
                    createdAt,
                    actorType: "user",
                    actorId: uid,
                });
                tx.set(lookbookRef, {
                    likesCount: FieldValue.increment(1),
                    updatedAt: createdAt,
                }, { merge: true });
            } else if (!canonicalSnap.exists && legacySnap.exists) {
                // Migrate legacy auth like key shape without touching counters.
                tx.set(canonicalLikeRef, {
                    createdAt,
                    actorType: "user",
                    actorId: uid,
                }, { merge: true });
            }
        });
    }

    // Upsert keeps sync idempotent across repeated client retries.
    for (const lookbookId of favoriteIds) {
        const ref = userFavoritesCollection(uid).doc(lookbookId);
        batch.set(ref, { createdAt }, { merge: true });
    }

    await batch.commit();
}

function userFavoritesCollection(uid) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("lookbooks_favorites");
}
