// Shared dev-mode showroom filtering helpers.

import { isCountryBlocked } from "../../../constants/countries.js";
import { DEV_STORE } from "../_store.js";
import { getVisibilityFilter } from "./utils/visibility.js";

/**
 * Applies the shared visibility rule-set used by showroom list/suggestions/counters.
 */
function applyVisibility(result, visibility, user) {
    if (visibility.type === "guest") {
        return result.filter(s => s.status === "approved");
    }

    if (visibility.type === "owner") {
        const ownerItems = result.filter(s => s.ownerUid === user.uid);
        if (!visibility.status) return ownerItems;
        if (visibility.status === "deleted") return [];
        return ownerItems.filter(s => s.status === visibility.status);
    }

    if (visibility.type === "admin" && visibility.status) {
        return result.filter(s => s.status === visibility.status);
    }

    return result;
}

/**
 * Filters showroom data from DEV_STORE the same way production filters are interpreted.
 */
export function filterDevShowroomsBase(parsed, user, options = {}) {
    const { includeGeohash = false, includeQName = false, visibility: providedVisibility = null } =
        options;
    const filters = parsed.raw ?? {};
    const visibility = providedVisibility ?? getVisibilityFilter(user, filters.status);

    // Step 1: visibility/security filter, same decision matrix as production query builder.
    let result = applyVisibility(DEV_STORE.showrooms, visibility, user);

    // Step 2: deterministic business filters (country/city/type/availability/category/...).
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
    if (parsed.categories?.length > 0) {
        result = result.filter(s => parsed.categories.includes(s.category));
    }
    if (parsed.categoryGroups?.length > 0) {
        result = result.filter(s => parsed.categoryGroups.includes(s.categoryGroup));
    }
    if (parsed.subcategories?.length > 0) {
        result = result.filter(s =>
            (s.subcategories ?? []).some(sub => parsed.subcategories.includes(sub))
        );
    }
    if (parsed.brandKey) {
        result = result.filter(s =>
            s.brandsMap?.[parsed.brandKey] === true ||
            (s.brandsNormalized ?? []).includes(parsed.brandNormalized)
        );
    }

    if (includeGeohash && parsed.geohashPrefixes?.length > 0) {
        // Geohash filter emulates Firestore prefix range scan.
        result = result.filter(s => {
            const hash = s.geo?.geohash ?? "";
            return parsed.geohashPrefixes.some(prefix => String(hash).startsWith(prefix));
        });
    }

    if (includeQName && parsed.qName) {
        // Name prefix mode uses normalized startsWith semantics.
        result = result.filter(s => String(s.nameNormalized ?? "").startsWith(parsed.qName));
    }

    // Step 3: final visibility hardening + blocked countries cleanup.
    if (!user || user.role === "owner") {
        result = result.filter(s => s.status !== "deleted");
    }

    return result.filter(s => !isCountryBlocked(s.country));
}
