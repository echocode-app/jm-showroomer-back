import { getFirestoreInstance } from "../../config/firebase.js";

const DEFAULT_LIMIT = 50;

// listLookbooksService
export async function listLookbooksService({ limit } = {}) {
    const db = getFirestoreInstance();
    let query = db.collection("lookbooks").where("published", "==", true);

    const finalLimit = Number(limit) || DEFAULT_LIMIT;
    if (finalLimit > 0) {
        query = query.limit(finalLimit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
