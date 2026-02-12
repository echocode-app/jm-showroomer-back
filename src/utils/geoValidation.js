// Utils: geo validation.

import ngeohash from "ngeohash";

export function normalizeCity(city) {
    // City normalization is the canonical key used by list filters and indexes.
    if (city === null || city === undefined) return null;
    return String(city).trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildGeo(inputGeo = {}) {
    // Step 1: keep raw city/country as user-facing values.
    // Step 2: recompute all derived geo search fields server-side.
    // This prevents client-side drift and keeps map/search indexes consistent.
    const city = inputGeo.city ?? "";
    const cityNormalized = normalizeCity(city);
    const country = inputGeo.country ?? null;
    const placeId = inputGeo.placeId ?? null;
    const coords = inputGeo.coords ?? {};
    const { lat, lng } = coords;
    // Precision 9 gives stable neighborhood-level buckets for map filtering.
    const geohash = ngeohash.encode(lat, lng, 9);

    return {
        city,
        cityNormalized,
        country,
        coords: { lat, lng },
        geohash,
        placeId,
    };
}
