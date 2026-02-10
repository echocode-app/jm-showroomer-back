// Service: showroom suggestions.

import { FieldPath } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { normalizeCity } from "../../utils/geoValidation.js";
import { normalizeBrand, normalizeKey } from "../../utils/showroomValidation.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { buildBaseQuery } from "./list/firestore/baseQuery.js";
import { parseSuggestionsFilters } from "./list/parse/suggestions.js";
import {
    applyVisibilityPostFilter,
    getVisibilityFilter,
} from "./list/utils/visibility.js";

const SAMPLE_LIMIT = 200;
const SHOWROOM_SUGGEST_LIMIT = 10;

export async function suggestShowroomsService(filters = {}, user = null) {
    const parsed = parseSuggestionsFilters(filters);

    if (parsed.qTooShort) {
        return { suggestions: [], meta: { limit: parsed.limit, q: parsed.q } };
    }

    if (useDevMock) {
        return suggestShowroomsDev(parsed, user);
    }

    const db = getFirestoreInstance();
    const baseQuery = buildBaseQuery(db.collection("showrooms"), parsed, user);

    const suggestions = [];
    const pushUnique = (item, seen) => {
        const key = `${item.type}:${String(item.value).toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        suggestions.push(item);
        return true;
    };

    const seen = new Set();

    if (parsed.qMode !== "city") {
        const showroomSuggestions = await fetchShowroomSuggestions(
            baseQuery,
            parsed,
            user
        );
        for (const item of showroomSuggestions) {
            if (suggestions.length >= parsed.limit) break;
            pushUnique(item, seen);
        }
    }

    if (parsed.qMode === "city" && suggestions.length < parsed.limit) {
        const citySuggestions = await fetchCitySuggestions(
            baseQuery,
            parsed,
            user,
            SAMPLE_LIMIT
        );
        for (const item of citySuggestions) {
            if (suggestions.length >= parsed.limit) break;
            pushUnique(item, seen);
        }
    }

    if (parsed.qMode !== "city" && suggestions.length < parsed.limit) {
        const brandSuggestions = await fetchBrandSuggestions(
            baseQuery,
            parsed,
            user,
            SAMPLE_LIMIT
        );
        for (const item of brandSuggestions) {
            if (suggestions.length >= parsed.limit) break;
            pushUnique(item, seen);
        }
    }

    return { suggestions, meta: { limit: parsed.limit, q: parsed.q } };
}

function suggestShowroomsDev(parsed, user) {
    const base = filterDevShowrooms(parsed, user);
    const suggestions = [];
    const seen = new Set();

    const pushUnique = item => {
        const key = `${item.type}:${String(item.value).toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        suggestions.push(item);
        return true;
    };

    if (parsed.qMode !== "city") {
        const showroomItems = base
            .filter(s => String(s.nameNormalized ?? "").startsWith(parsed.qName))
            .slice(0, Math.min(parsed.limit, SHOWROOM_SUGGEST_LIMIT))
            .map(s => ({
                type: "showroom",
                value: s.name ?? "",
                payload: {
                    id: s.id,
                    name: s.name ?? "",
                    city: s.geo?.city ?? s.city ?? null,
                    country: s.country ?? null,
                },
            }));
        for (const item of showroomItems) {
            if (suggestions.length >= parsed.limit) break;
            pushUnique(item);
        }
    }

    if (parsed.qMode === "city" && suggestions.length < parsed.limit) {
        const cityItems = buildCitySuggestions(base, parsed);
        for (const item of cityItems) {
            if (suggestions.length >= parsed.limit) break;
            pushUnique(item);
        }
    }

    if (parsed.qMode !== "city" && suggestions.length < parsed.limit) {
        const brandItems = buildBrandSuggestions(base, parsed);
        for (const item of brandItems) {
            if (suggestions.length >= parsed.limit) break;
            pushUnique(item);
        }
    }

    return { suggestions, meta: { limit: parsed.limit, q: parsed.q } };
}

function filterDevShowrooms(parsed, user) {
    const filters = parsed.raw;
    let result = DEV_STORE.showrooms;
    const visibility = getVisibilityFilter(user, filters.status);

    if (visibility.type === "guest") {
        result = result.filter(s => s.status === "approved");
    } else if (visibility.type === "owner") {
        result = result.filter(s => s.ownerUid === user.uid);
        if (visibility.status) {
            if (visibility.status === "deleted") return [];
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

    if (!user || user.role === "owner") {
        result = result.filter(s => s.status !== "deleted");
    }

    result = result.filter(s => !isCountryBlocked(s.country));
    return result;
}

function buildCitySuggestions(items, parsed) {
    const qCity = parsed.qCityNormalized ?? normalizeCity(parsed.q);
    const map = new Map();
    for (const s of items) {
        const city = s.geo?.city ?? s.city ?? null;
        const cityNorm = s.geo?.cityNormalized ?? (city ? normalizeCity(city) : null);
        if (!city || !cityNorm) continue;
        if (!cityNorm.startsWith(qCity)) continue;
        if (!map.has(cityNorm)) {
            map.set(cityNorm, {
                type: "city",
                value: city,
                payload: {
                    cityNormalized: cityNorm,
                    country: s.country ?? null,
                },
            });
        }
    }
    return Array.from(map.values());
}

function buildBrandSuggestions(items, parsed) {
    const qBrand = normalizeBrand(parsed.q);
    const qKey = normalizeKey(parsed.q);
    if (!qBrand && !qKey) return [];

    const map = new Map();
    for (const s of items) {
        const brands = Array.isArray(s.brands) ? s.brands : [];
        for (const brand of brands) {
            const normalized = normalizeBrand(brand);
            if (!normalized || !normalized.startsWith(qBrand)) continue;
            const key = normalizeKey(brand);
            if (!key) continue;
            if (!map.has(key)) {
                map.set(key, {
                    type: "brand",
                    value: brand,
                    payload: { brandKey: key },
                });
            }
        }
        if (brands.length === 0 && s.brandsMap) {
            for (const key of Object.keys(s.brandsMap)) {
                if (!qKey || !key.startsWith(qKey)) continue;
                if (!map.has(key)) {
                    map.set(key, {
                        type: "brand",
                        value: key,
                        payload: { brandKey: key },
                    });
                }
            }
        }
    }
    return Array.from(map.values());
}

async function fetchShowroomSuggestions(baseQuery, parsed, user) {
    const limit = Math.min(parsed.limit, SHOWROOM_SUGGEST_LIMIT);
    let query = baseQuery
        .where("nameNormalized", ">=", parsed.qName)
        .where("nameNormalized", "<=", `${parsed.qName}\uf8ff`)
        .orderBy("nameNormalized", "asc")
        .orderBy(FieldPath.documentId(), "asc")
        .limit(limit);

    const snapshot = await query.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    items = applyVisibilityPostFilter(items, user);
    items = items.filter(s => !isCountryBlocked(s.country));

    return items.map(s => ({
        type: "showroom",
        value: s.name ?? "",
        payload: {
            id: s.id,
            name: s.name ?? "",
            city: s.geo?.city ?? s.city ?? null,
            country: s.country ?? null,
        },
    }));
}

async function fetchCitySuggestions(baseQuery, parsed, user, sampleLimit) {
    const sample = await fetchSampleShowrooms(baseQuery, parsed, user, sampleLimit);
    const qCity = parsed.qCityNormalized ?? normalizeCity(parsed.q);

    const map = new Map();
    for (const s of sample) {
        const city = s.geo?.city ?? s.city ?? null;
        const cityNorm = s.geo?.cityNormalized ?? (city ? normalizeCity(city) : null);
        if (!city || !cityNorm) continue;
        if (!cityNorm.startsWith(qCity)) continue;
        if (!map.has(cityNorm)) {
            map.set(cityNorm, {
                type: "city",
                value: city,
                payload: {
                    cityNormalized: cityNorm,
                    country: s.country ?? null,
                },
            });
        }
    }
    return Array.from(map.values());
}

async function fetchBrandSuggestions(baseQuery, parsed, user, sampleLimit) {
    const sample = await fetchSampleShowrooms(baseQuery, parsed, user, sampleLimit);
    const qBrand = normalizeBrand(parsed.q);
    const qKey = normalizeKey(parsed.q);
    if (!qBrand && !qKey) return [];

    const map = new Map();
    for (const s of sample) {
        const brands = Array.isArray(s.brands) ? s.brands : [];
        for (const brand of brands) {
            const normalized = normalizeBrand(brand);
            if (!normalized || !normalized.startsWith(qBrand)) continue;
            const key = normalizeKey(brand);
            if (!key) continue;
            if (!map.has(key)) {
                map.set(key, {
                    type: "brand",
                    value: brand,
                    payload: { brandKey: key },
                });
            }
        }
        if (brands.length === 0 && s.brandsMap) {
            for (const key of Object.keys(s.brandsMap)) {
                if (!qKey || !key.startsWith(qKey)) continue;
                if (!map.has(key)) {
                    map.set(key, {
                        type: "brand",
                        value: key,
                        payload: { brandKey: key },
                    });
                }
            }
        }
    }
    return Array.from(map.values());
}

async function fetchSampleShowrooms(baseQuery, parsed, user, sampleLimit) {
    if (parsed.geohashPrefixes.length === 0) {
        let query = baseQuery
            .orderBy("nameNormalized", "asc")
            .orderBy(FieldPath.documentId(), "asc")
            .limit(sampleLimit);
        const snapshot = await query.get();
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        items = applyVisibilityPostFilter(items, user);
        return items.filter(s => !isCountryBlocked(s.country));
    }

    const perPrefix = Math.max(1, Math.ceil(sampleLimit / parsed.geohashPrefixes.length));
    const snapshots = await Promise.all(
        parsed.geohashPrefixes.map(prefix =>
            baseQuery
                .where("geo.geohash", ">=", prefix)
                .where("geo.geohash", "<=", `${prefix}\uf8ff`)
                .orderBy("geo.geohash", "asc")
                .orderBy(FieldPath.documentId(), "asc")
                .limit(perPrefix)
                .get()
        )
    );

    let items = snapshots.flatMap(s => s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    items = applyVisibilityPostFilter(items, user);
    return items.filter(s => !isCountryBlocked(s.country));
}
