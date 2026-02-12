// Showroom list ordering helpers.

// Showroom list ordering rules.
export function getOrdering(parsed) {
    // Map mode naturally sorts by geohash to keep geographic buckets grouped.
    if (parsed.geohashPrefixes.length > 0) {
        return { orderField: "geo.geohash", direction: "asc" };
    }
    // Name search mode must sort by normalized name to keep prefix paging stable.
    if (parsed.qName) {
        return { orderField: "nameNormalized", direction: "asc" };
    }
    // Default feed favors recently updated entities.
    return { orderField: "updatedAt", direction: "desc" };
}
