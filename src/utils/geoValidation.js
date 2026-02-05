import ngeohash from "ngeohash";

export function normalizeCity(city) {
    if (city === null || city === undefined) return null;
    return String(city).trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildGeo(inputGeo = {}) {
    const city = inputGeo.city ?? "";
    const cityNormalized = normalizeCity(city);
    const country = inputGeo.country ?? null;
    const placeId = inputGeo.placeId ?? null;
    const coords = inputGeo.coords ?? {};
    const { lat, lng } = coords;
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
