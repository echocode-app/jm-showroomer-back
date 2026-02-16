import { encodeListCursor, parseLookbookListFilters } from "./parse.js";
import { fetchRanked, fetchUnranked } from "./list/queryFetch.js";
import { fetchWithInMemoryFallback } from "./list/fallback.js";

export async function listLookbooksService(filters = {}) {
    const parsed = parseLookbookListFilters(filters);
    const maxItems = parsed.limit + 1;

    let items;
    try {
        const ranked = await fetchRanked(parsed, maxItems);
        items = ranked.length >= maxItems
            ? ranked.slice(0, maxItems)
            : ranked.concat(await fetchUnranked(parsed, maxItems - ranked.length));
    } catch (err) {
        if (!shouldUseFallback(err)) {
            throw err;
        }
        // Dev/test fallback avoids hard dependency on composite indexes.
        items = await fetchWithInMemoryFallback(parsed, maxItems);
    }

    const hasMore = items.length > parsed.limit;
    const pageItems = items.slice(0, parsed.limit);
    const last = pageItems[pageItems.length - 1] ?? null;

    const nextCursor = hasMore && last
        ? encodeListCursor(last.cursor)
        : null;

    return {
        lookbooks: pageItems.map(item => item.payload),
        meta: {
            hasMore,
            nextCursor,
            paging: hasMore ? "enabled" : "end",
        },
    };
}

function shouldUseFallback(err) {
    return err?.code === "INDEX_NOT_READY" && process.env.NODE_ENV !== "prod";
}
