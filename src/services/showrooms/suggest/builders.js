// Builders for suggestion payloads.

import { normalizeCity } from "../../../utils/geoValidation.js";
import { normalizeBrand, normalizeKey } from "../../../utils/showroomValidation.js";

/**
 * Creates a stable dedupe key for cross-type suggestions.
 */
function getSuggestionKey(item) {
    return `${item.type}:${String(item.value).toLowerCase()}`;
}

/**
 * Adds a suggestion only once across all sources.
 */
export function pushUniqueSuggestion(item, list, seen) {
    const key = getSuggestionKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    list.push(item);
    return true;
}

/**
 * Converts a showroom document into API suggestion payload.
 */
export function toShowroomSuggestion(showroom) {
    return {
        type: "showroom",
        value: showroom.name ?? "",
        payload: {
            id: showroom.id,
            name: showroom.name ?? "",
            city: showroom.geo?.city ?? showroom.city ?? null,
            country: showroom.country ?? null,
        },
    };
}

/**
 * Builds city suggestions from an in-memory showroom sample.
 */
export function buildCitySuggestions(items, parsed) {
    const qCity = parsed.qCityNormalized ?? normalizeCity(parsed.q);
    const map = new Map();

    for (const showroom of items) {
        const city = showroom.geo?.city ?? showroom.city ?? null;
        const cityNorm =
            showroom.geo?.cityNormalized ?? (city ? normalizeCity(city) : null);
        if (!city || !cityNorm) continue;
        if (!cityNorm.startsWith(qCity)) continue;

        if (!map.has(cityNorm)) {
            map.set(cityNorm, {
                type: "city",
                value: city,
                payload: {
                    cityNormalized: cityNorm,
                    country: showroom.country ?? null,
                },
            });
        }
    }

    return Array.from(map.values());
}

/**
 * Builds brand suggestions from an in-memory showroom sample.
 */
export function buildBrandSuggestions(items, parsed) {
    const qBrand = normalizeBrand(parsed.q);
    const qKey = normalizeKey(parsed.q);
    if (!qBrand && !qKey) return [];

    const map = new Map();

    for (const showroom of items) {
        const brands = Array.isArray(showroom.brands) ? showroom.brands : [];

        for (const brand of brands) {
            const normalized = normalizeBrand(brand);
            if (!normalized || !normalized.startsWith(qBrand)) continue;

            const key = normalizeKey(brand);
            if (!key || map.has(key)) continue;

            map.set(key, {
                type: "brand",
                value: brand,
                payload: { brandKey: key },
            });
        }

        if (brands.length === 0 && showroom.brandsMap) {
            for (const key of Object.keys(showroom.brandsMap)) {
                if (!qKey || !key.startsWith(qKey)) continue;
                if (map.has(key)) continue;

                map.set(key, {
                    type: "brand",
                    value: key,
                    payload: { brandKey: key },
                });
            }
        }
    }

    return Array.from(map.values());
}
