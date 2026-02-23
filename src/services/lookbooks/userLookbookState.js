import { Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { notFound } from "../../core/error.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { getLookbooksCollection } from "./firestoreQuery.js";
import { parseCollectionLimit } from "./parse.js";
import { normalizeLookbook } from "./response.js";

const IDS_CHUNK = 100;

export async function favoriteLookbook(lookbookId, uid) {
    const db = getFirestoreInstance();
    const now = Timestamp.fromDate(new Date());
    const ref = userFavoritesCollection(uid).doc(lookbookId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        const lookbookSnap = await tx.get(getLookbooksCollection().doc(lookbookId));
        const lookbook = lookbookSnap.exists
            ? normalizeLookbook({ id: lookbookSnap.id, ...lookbookSnap.data() })
            : null;
        if (!lookbook || lookbook.published !== true) {
            throw notFound("LOOKBOOK_NOT_FOUND");
        }
        tx.set(ref, { createdAt: now }, { merge: true });
    });
}

export async function unfavoriteLookbook(lookbookId, uid) {
    const db = getFirestoreInstance();
    const ref = userFavoritesCollection(uid).doc(lookbookId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        tx.delete(ref);
    });
}

export async function listFavoriteLookbooks(uid, filters = {}) {
    const { limit } = parseCollectionLimit(filters);

    // Read IDs first to preserve favorite ordering by createdAt.
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

    // Firestore getAll supports up to 100 refs per call.
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
