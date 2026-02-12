// Showroom list (dev mock) implementation.
import { getOrdering } from "./ordering.js";
import { filterDevShowroomsBase } from "./devFilters.js";
import {
    applyCursorFilter,
    applyFieldMode,
    buildMeta,
    compareValues,
    getValueByPath,
    getVisibilityFilter,
} from "./utils.js";

/**
 * Executes showroom listing against DEV_STORE while keeping production-like filters.
 */
export function listShowroomsDev(parsed, user) {
    const filters = parsed.raw;
    const visibility = getVisibilityFilter(user, filters.status);
    if (visibility.type === "owner" && visibility.status === "deleted") {
        return {
            showrooms: [],
            meta: { nextCursor: null, hasMore: false, paging: "end" },
        };
    }

    let result = filterDevShowroomsBase(parsed, user, {
        includeGeohash: true,
        includeQName: true,
        visibility,
    });

    // Keep the same final ordering contract as Firestore path.
    const { orderField, direction } = getOrdering(parsed);
    result.sort((a, b) => {
        const cmp = compareValues(
            getValueByPath(a, orderField),
            getValueByPath(b, orderField),
            direction
        );
        if (cmp !== 0) return cmp;
        return a.id.localeCompare(b.id);
    });

    if (parsed.cursorDisabled) {
        // In multi-prefix mode dev path mirrors production: return one non-cursor page.
        const { pageItems, meta } = buildMeta(result, parsed.limit, orderField, direction, {
            paging: "disabled",
            reason: "multi_geohash_prefixes",
        });
        const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
        return { showrooms, meta };
    }

    const cursorFiltered = applyCursorFilter(result, parsed.cursor, orderField, direction);
    const { pageItems, meta } = buildMeta(
        cursorFiltered,
        parsed.limit,
        orderField,
        direction
    );
    const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));

    return { showrooms, meta };
}
