// Parsing helpers for showroom suggestions.

import { badRequest } from "../../../../core/error.js";
import { normalizeCity } from "../../../../utils/geoValidation.js";
import {
    normalizeBrand,
    normalizeKey,
    normalizeShowroomName,
} from "../../../../utils/showroomValidation.js";
import {
    parseCategoryGroups,
    parseSubcategories,
} from "./filters.js";
import { parseList, parseQMode, parseType } from "./lists.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

/**
 * Parses and normalizes explicit city filter.
 */
function parseCityFilter(filters) {
    if (filters.city === undefined) return null;
    if (String(filters.city).trim() === "") {
        throw badRequest("QUERY_INVALID");
    }
    return normalizeCity(filters.city);
}

/**
 * Parses brand filter into normalized key/value pair.
 */
function parseBrandFilter(filters) {
    if (filters.brand === undefined) return { brandKey: null, brandNormalized: null };
    const key = normalizeKey(filters.brand);
    if (!key) throw badRequest("QUERY_INVALID");
    return { brandKey: key, brandNormalized: normalizeBrand(filters.brand) };
}

/**
 * Validates suggestion limit.
 */
function parseLimit(value) {
    if (value === undefined || value === null || value === "") return DEFAULT_LIMIT;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw badRequest("QUERY_INVALID");
    }
    if (parsed < 1 || parsed > MAX_LIMIT) {
        throw badRequest("QUERY_INVALID");
    }
    return parsed;
}

/**
 * Suggestions endpoint does not support geohash constraints.
 */
function parseGeohashPrefixes(filters) {
    const hasPrefix = filters.geohashPrefix !== undefined;
    const hasPrefixes = filters.geohashPrefixes !== undefined;
    if (hasPrefix && hasPrefixes) {
        throw badRequest("QUERY_INVALID");
    }
    let geohashPrefixes = [];
    if (hasPrefix) geohashPrefixes = parseList(filters.geohashPrefix);
    if (hasPrefixes) geohashPrefixes = parseList(filters.geohashPrefixes);
    if ((hasPrefix || hasPrefixes) && geohashPrefixes.length === 0) {
        throw badRequest("QUERY_INVALID");
    }
    return geohashPrefixes;
}

/**
 * Parses and validates full query for suggestions endpoint.
 */
export function parseSuggestionsFilters(filters = {}) {
    // Step 1: `q` is mandatory because suggestions are query-driven by definition.
    const qRaw = filters.q;
    if (qRaw === undefined || String(qRaw).trim() === "") {
        throw badRequest("QUERY_INVALID");
    }
    const q = String(qRaw).trim();
    const qMode = parseQMode(filters.qMode) ?? "name";
    // Step 2: suggestion limit is intentionally stricter than full list limit.
    const limit = parseLimit(filters.limit);

    const geohashPrefixes = parseGeohashPrefixes(filters);
    // Suggestions endpoint does not expose geo-prefix map mode.
    if (geohashPrefixes.length > 0) {
        throw badRequest("QUERY_INVALID");
    }

    // Step 3: parse reusable showroom filters to keep behavior aligned with list endpoint.
    const cityNormalized = parseCityFilter(filters);
    const { brandKey, brandNormalized } = parseBrandFilter(filters);
    const type = parseType(filters.type);
    const categoryGroups = parseCategoryGroups(filters.categoryGroup);
    const subcategories = parseSubcategories(filters.subcategories);
    if (categoryGroups.length > 0 && subcategories.length > 0) {
        if (!categoryGroups.includes("clothing")) {
            throw badRequest("QUERY_INVALID");
        }
    }
    const categories = parseList(filters.categories);
    const listFilterCount =
        (categories.length > 0 ? 1 : 0) +
        (categoryGroups.length > 0 ? 1 : 0) +
        (subcategories.length > 0 ? 1 : 0);
    if (listFilterCount > 1) {
        throw badRequest("QUERY_INVALID");
    }

    const qTooShort = q.length < 2;
    let qName = null;
    let qCityNormalized = null;
    if (!qTooShort) {
        // Step 4: resolve runtime search key based on qMode.
        if (qMode === "city") {
            qCityNormalized = cityNormalized ?? normalizeCity(q);
        } else {
            qName = normalizeShowroomName(q);
            if (!qName) throw badRequest("QUERY_INVALID");
        }
    }

    return {
        raw: filters,
        q,
        qMode,
        qTooShort,
        qName,
        qCityNormalized,
        limit,
        cityNormalized,
        brandKey,
        brandNormalized,
        type,
        categoryGroups,
        subcategories,
        categories,
        geohashPrefixes,
    };
}
