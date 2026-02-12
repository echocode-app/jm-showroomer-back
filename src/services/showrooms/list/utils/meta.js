// Pagination meta builder + cursor encoding.

import { encodeCursor } from "../parse/index.js";
import { getValueByPath } from "./values.js";

export function buildMeta(items, limit, orderField, direction, options = {}) {
    const pagingMode = options.paging ?? "enabled";
    const reason = options.reason ?? null;
    // Always trim to requested page size; caller may pass limit+1 input for hasMore probe.
    const pageItems = items.slice(0, limit);

    if (pagingMode === "disabled") {
        // Explicit disabled mode is used for cases where stable cursor continuation is impossible.
        const meta = { nextCursor: null, hasMore: false, paging: "disabled" };
        if (reason) meta.reason = reason;
        return { pageItems, meta };
    }

    const hasMore = items.length > limit;
    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
        // Cursor points to the last emitted row in current order mode.
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

    const paging = hasMore ? "enabled" : "end";
    return { pageItems, meta: { nextCursor, hasMore, paging } };
}
