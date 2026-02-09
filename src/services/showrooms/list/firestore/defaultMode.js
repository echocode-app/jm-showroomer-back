// Default list mode with ordering + cursor for Firestore query.

import { isCountryBlocked } from "../../../../constants/countries.js";
import { applyFieldMode, applyVisibilityPostFilter, buildMeta } from "../utils/index.js";

export async function runDefaultMode(baseQuery, parsed, orderField, direction, applyOrdering) {
    let query = baseQuery;
    query = applyOrdering(query, orderField, direction);
    if (parsed.cursor) {
        query = query.startAfter(parsed.cursor.value, parsed.cursor.id);
    }
    query = query.limit(parsed.limit + 1);

    const snapshot = await query.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    items = applyVisibilityPostFilter(items, parsed.user);
    items = items.filter(s => !isCountryBlocked(s.country));
    const { pageItems, meta } = buildMeta(items, parsed.limit, orderField, direction);
    const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
    return { showrooms, meta };
}
