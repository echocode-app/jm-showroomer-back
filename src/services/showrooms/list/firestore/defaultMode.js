// Default list mode with ordering + cursor for Firestore query.

import { isCountryBlocked } from "../../../../constants/countries.js";
import {
    applyFieldMode,
    applyVisibilityPostFilter,
    buildMeta,
    scanOrderedQuery,
} from "../utils/index.js";

export async function runDefaultMode(baseQuery, parsed, orderField, direction, applyOrdering) {
    // Default feed uses mode-derived ordering (`updatedAt desc` unless parser says otherwise).
    const query = applyOrdering(baseQuery, orderField, direction);
    const { items } = await scanOrderedQuery(query, {
        cursor: parsed.cursor,
        limit: parsed.limit,
        orderField,
        transform: item => {
            if (applyVisibilityPostFilter([item], parsed.user).length === 0) return null;
            if (isCountryBlocked(item.country)) return null;
            return item;
        },
    });

    const { pageItems, meta } = buildMeta(items, parsed.limit, orderField, direction);
    const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
    return { showrooms, meta };
}
