import { getLookbooksCollection } from "../firestoreQuery.js";
import { normalizeLookbook } from "../response.js";
import { buildCursorFromItem, compareLookbooks, compareToCursor } from "./sortCursor.js";

export async function fetchWithInMemoryFallback(parsed, limit) {
    const snap = await getLookbooksCollection()
        .where("published", "==", true)
        .get();

    const filtered = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .map(normalizeLookbook)
        .filter(item => item.countryNormalized === parsed.countryNormalized)
        .filter(item => !parsed.seasonKey || item.seasonKey === parsed.seasonKey);

    // Mirror production ordering in fallback mode to preserve cursor behavior.
    filtered.sort(compareLookbooks);

    const afterCursor = parsed.cursor
        ? filtered.filter(item => compareToCursor(item, parsed.cursor) > 0)
        : filtered;

    return afterCursor.slice(0, limit).map(item => ({
        payload: item,
        cursor: buildCursorFromItem(item),
    }));
}
