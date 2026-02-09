// Parsing helpers for list filters (brand/category/city/qName/geohash).

import { badRequest } from "../../../../core/error.js";
import { normalizeCity } from "../../../../utils/geoValidation.js";
import {
    normalizeBrand,
    normalizeKey,
    normalizeShowroomName,
} from "../../../../utils/showroomValidation.js";
import {
    CATEGORY_GROUP_SET,
    CLOTHING_SUBCATEGORY_SET,
} from "../../_categoryConstants.js";
import { MAX_GEO_PREFIXES } from "./constants.js";
import { parseList } from "./lists.js";

export function parseCityAndQName(filters, qMode) {
    let cityNormalized = null;
    let qName = null;

    if (filters.city !== undefined) {
        if (String(filters.city).trim() === "") {
            throw badRequest("QUERY_INVALID");
        }
        cityNormalized = normalizeCity(filters.city);
    }

    if (qMode === "city" && !cityNormalized) {
        if (!filters.q || String(filters.q).trim() === "") {
            throw badRequest("QUERY_INVALID");
        }
        cityNormalized = normalizeCity(filters.q);
    }

    if (!cityNormalized && filters.q !== undefined) {
        const normalized = normalizeShowroomName(filters.q);
        if (!normalized) throw badRequest("QUERY_INVALID");
        qName = normalized;
    }

    return { cityNormalized, qName };
}

export function parseBrandFilter(filters) {
    let brandKey = null;
    let brandNormalized = null;
    if (filters.brand !== undefined) {
        const key = normalizeKey(filters.brand);
        if (!key) throw badRequest("QUERY_INVALID");
        brandKey = key;
        brandNormalized = normalizeBrand(filters.brand);
    }
    return { brandKey, brandNormalized };
}

export function parseCategoryGroups(value) {
    const groups = parseList(value)
        .map(v => normalizeKey(v))
        .filter(Boolean)
        .filter(v => v !== "all");

    const invalid = groups.filter(g => !CATEGORY_GROUP_SET.has(g));
    if (invalid.length > 0) throw badRequest("QUERY_INVALID");
    if (groups.length > 10) throw badRequest("QUERY_INVALID");
    return Array.from(new Set(groups));
}

export function parseSubcategories(value) {
    const subs = parseList(value)
        .map(v => normalizeKey(v))
        .filter(Boolean)
        .filter(v => v !== "all");

    const invalid = subs.filter(s => !CLOTHING_SUBCATEGORY_SET.has(s));
    if (invalid.length > 0) throw badRequest("QUERY_INVALID");
    if (subs.length > 10) throw badRequest("QUERY_INVALID");
    return Array.from(new Set(subs));
}

export function parseGeohashPrefixes(filters) {
    const geohashPrefixes = Array.from(
        new Set([
            ...parseList(filters.geohashPrefixes),
            ...parseList(filters.geohashPrefix),
        ])
    );
    if (
        (filters.geohashPrefix !== undefined ||
            filters.geohashPrefixes !== undefined) &&
        geohashPrefixes.length === 0
    ) {
        throw badRequest("QUERY_INVALID");
    }
    if (geohashPrefixes.length > MAX_GEO_PREFIXES) {
        throw badRequest("QUERY_INVALID");
    }
    return geohashPrefixes;
}
