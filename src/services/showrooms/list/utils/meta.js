// Pagination meta builder + cursor encoding.

import { encodeCursor } from "../parse/index.js";
import { getValueByPath } from "./values.js";

export function buildMeta(items, limit, orderField, direction) {
    const hasMore = items.length > limit;
    const pageItems = items.slice(0, limit);
    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
        const last = pageItems[pageItems.length - 1];
        nextCursor = encodeCursor(
            {
                value: getValueByPath(last, orderField),
                id: last.id,
            },
            orderField,
            direction
        );
    }
    return { pageItems, meta: { nextCursor, hasMore } };
}
