// Showroom list dev helpers.

// Showroom list (dev mock) implementation.
import { isCountryBlocked } from "../../../constants/countries.js";
import { DEV_STORE } from "../_store.js";
import { getOrdering } from "./ordering.js";
import {
    applyCursorFilter,
    applyFieldMode,
    buildMeta,
    compareValues,
    getValueByPath,
    getVisibilityFilter,
} from "./utils.js";

export function listShowroomsDev(parsed, user) {
    const filters = parsed.raw;
    let result = DEV_STORE.showrooms;

    const visibility = getVisibilityFilter(user, filters.status);
    if (visibility.type === "guest") {
        result = result.filter(s => s.status === "approved");
    } else if (visibility.type === "owner") {
        result = result.filter(s => s.ownerUid === user.uid);
        if (visibility.status) {
            if (visibility.status === "deleted") {
                return {
                    showrooms: [],
                    meta: { nextCursor: null, hasMore: false, paging: "end" },
                };
            }
            result = result.filter(s => s.status === visibility.status);
        }
    } else if (visibility.type === "admin" && visibility.status) {
        result = result.filter(s => s.status === visibility.status);
    }

    if (filters.country) result = result.filter(s => s.country === filters.country);
    if (parsed.cityNormalized) {
        result = result.filter(s => s.geo?.cityNormalized === parsed.cityNormalized);
    }
    if (parsed.type) result = result.filter(s => s.type === parsed.type);
    if (filters.availability) {
        result = result.filter(s => s.availability === filters.availability);
    }
    if (filters.category) {
        result = result.filter(s => s.category === filters.category);
    }
    if (parsed.categories.length > 0) {
        result = result.filter(s => parsed.categories.includes(s.category));
    }
    if (parsed.categoryGroups.length > 0) {
        result = result.filter(s =>
            parsed.categoryGroups.includes(s.categoryGroup)
        );
    }
    if (parsed.subcategories.length > 0) {
        result = result.filter(s =>
            (s.subcategories ?? []).some(sub =>
                parsed.subcategories.includes(sub)
            )
        );
    }
    if (parsed.brandKey) {
        result = result.filter(s =>
            s.brandsMap?.[parsed.brandKey] === true ||
            (s.brandsNormalized ?? []).includes(parsed.brandNormalized)
        );
    }

    if (parsed.geohashPrefixes.length > 0) {
        result = result.filter(s => {
            const hash = s.geo?.geohash ?? "";
            return parsed.geohashPrefixes.some(prefix =>
                String(hash).startsWith(prefix)
            );
        });
    }

    if (parsed.qName) {
        result = result.filter(s => {
            const nameOk = parsed.qName
                ? String(s.nameNormalized ?? "").startsWith(parsed.qName)
                : false;
            return nameOk;
        });
    }

    if (!user || user.role === "owner") {
        result = result.filter(s => s.status !== "deleted");
    }

    result = result.filter(s => !isCountryBlocked(s.country));

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
