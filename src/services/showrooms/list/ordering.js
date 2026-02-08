// Showroom list ordering helpers.

// Showroom list ordering rules.
export function getOrdering(parsed) {
    if (parsed.geohashPrefixes.length > 0) {
        return { orderField: "geo.geohash", direction: "asc" };
    }
    if (parsed.qName) {
        return { orderField: "nameNormalized", direction: "asc" };
    }
    return { orderField: "updatedAt", direction: "desc" };
}
