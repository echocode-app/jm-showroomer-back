import { Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { notFound } from "../../core/error.js";
import { getLookbooksCollection } from "./firestoreQuery.js";
import { parseCollectionLimit } from "./parse.js";
import { normalizeLookbook } from "./response.js";

const IDS_CHUNK = 100;

export async function favoriteLookbook(lookbookId, uid) {
    await assertLookbookPublished(lookbookId);

    await userFavoritesCollection(uid)
        .doc(lookbookId)
        .set({ createdAt: Timestamp.fromDate(new Date()) }, { merge: true });
}

export async function unfavoriteLookbook(lookbookId, uid) {
    await userFavoritesCollection(uid).doc(lookbookId).delete();
}

export async function listFavoriteLookbooks(uid, filters = {}) {
    const { limit } = parseCollectionLimit(filters);

    const ids = await getOrderedFavoriteIds(uid);
    if (ids.length === 0) {
        return {
            lookbooks: [],
            meta: { total: 0, returned: 0 },
        };
    }

    const lookbooks = await getLookbooksByIds(ids);
    const filtered = lookbooks
        .filter(item => item.published === true)
        .slice(0, limit);

    return {
        lookbooks: filtered,
        meta: {
            total: lookbooks.filter(item => item.published === true).length,
            returned: filtered.length,
        },
    };
}

export async function getUserFavoriteLookbookIds(uid) {
    const snap = await userFavoritesCollection(uid).get();
    return new Set(snap.docs.map(doc => doc.id));
}

export async function assertLookbookPublished(lookbookId) {
    const snap = await getLookbooksCollection().doc(lookbookId).get();
    const lookbook = snap.exists ? normalizeLookbook({ id: snap.id, ...snap.data() }) : null;

    if (!lookbook || lookbook.published !== true) {
        throw notFound("LOOKBOOK_NOT_FOUND");
    }

    return lookbook;
}

async function getOrderedFavoriteIds(uid) {
    const snap = await userFavoritesCollection(uid)
        .orderBy("createdAt", "asc")
        .get();

    return snap.docs.map(doc => doc.id);
}

async function getLookbooksByIds(ids) {
    const db = getFirestoreInstance();
    const refs = ids.map(id => getLookbooksCollection().doc(id));
    const lookbooks = [];

    for (let i = 0; i < refs.length; i += IDS_CHUNK) {
        const chunk = refs.slice(i, i + IDS_CHUNK);
        const snaps = await db.getAll(...chunk);

        snaps.forEach(snap => {
            if (snap.exists) {
                lookbooks.push(normalizeLookbook({ id: snap.id, ...snap.data() }));
            }
        });
    }

    return lookbooks;
}

function userFavoritesCollection(uid) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("lookbooks_favorites");
}
