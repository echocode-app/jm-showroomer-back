// Builds the Firestore base query with visibility + filter constraints.

import { getVisibilityFilter } from "../utils/index.js";

export function buildBaseQuery(query, parsed, user) {
    const filters = parsed.raw;
    const visibility = getVisibilityFilter(user, filters.status);

    if (visibility.type === "guest") {
        query = query.where("status", "==", "approved");
    } else if (visibility.type === "owner") {
        if (visibility.status === "deleted") {
            return query.where("status", "==", "__none__");
        }
        query = query.where("ownerUid", "==", user.uid);
        if (visibility.status) {
            query = query.where("status", "==", visibility.status);
        }
    } else if (visibility.type === "admin" && visibility.status) {
        query = query.where("status", "==", visibility.status);
    }

    if (filters.country) query = query.where("country", "==", filters.country);
    if (parsed.cityNormalized) {
        query = query.where("geo.cityNormalized", "==", parsed.cityNormalized);
    }
    if (parsed.type) query = query.where("type", "==", parsed.type);
    if (filters.availability) {
        query = query.where("availability", "==", filters.availability);
    }
    if (filters.category) query = query.where("category", "==", filters.category);
    if (parsed.categories.length > 0) {
        // Firestore limits "in" to max 10 values.
        const slice = parsed.categories.slice(0, 10);
        query = query.where("category", "in", slice);
    }
    if (parsed.categoryGroups.length > 0) {
        // Firestore limits "in" to max 10 values.
        const slice = parsed.categoryGroups.slice(0, 10);
        query = query.where("categoryGroup", "in", slice);
    }
    if (parsed.subcategories.length > 0) {
        // Firestore allows only one array operator per query; subcategories uses it.
        const slice = parsed.subcategories.slice(0, 10);
        query = query.where("subcategories", "array-contains-any", slice);
    }
    if (parsed.brandKey) {
        query = query.where(`brandsMap.${parsed.brandKey}`, "==", true);
    }

    return query;
}
