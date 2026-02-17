import { notFound } from "../../core/error.js";
import { getLookbooksCollection } from "./firestoreQuery.js";
import { normalizeLookbook } from "./response.js";

// Public detail endpoint exposes only published lookbooks.
export async function getLookbookByIdService(id) {
    const snap = await getLookbooksCollection().doc(id).get();
    const lookbook = snap.exists ? normalizeLookbook({ id: snap.id, ...snap.data() }) : null;

    if (!lookbook || lookbook.published !== true) {
        throw notFound("LOOKBOOK_NOT_FOUND");
    }

    return lookbook;
}
