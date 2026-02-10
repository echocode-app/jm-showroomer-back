// Parsing helpers for showroom counters.

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
import { MAX_GEO_PREFIXES } from "./constants.js";
import { parseList, parseType } from "./lists.js";

function parseCityFilter(filters) {
    if (filters.city === undefined) return null;
    if (String(filters.city).trim() === "") {
        throw badRequest("QUERY_INVALID");
    }
    return normalizeCity(filters.city);
}

function parseBrandFilter(filters) {
    if (filters.brand === undefined) return { brandKey: null, brandNormalized: null };
    const key = normalizeKey(filters.brand);
    if (!key) throw badRequest("QUERY_INVALID");
    return { brandKey: key, brandNormalized: normalizeBrand(filters.brand) };
}

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
    if (geohashPrefixes.length > MAX_GEO_PREFIXES) {
        throw badRequest("QUERY_INVALID");
    }
    return geohashPrefixes;
}

export function parseCountersFilters(filters = {}) {
    if (filters.cursor !== undefined || filters.fields !== undefined || filters.limit !== undefined) {
        throw badRequest("QUERY_INVALID");
    }

    const qRaw = filters.q;
    let qName = null;
    if (qRaw !== undefined) {
        if (String(qRaw).trim() === "") {
            throw badRequest("QUERY_INVALID");
        }
        const q = String(qRaw).trim();
        qName = normalizeShowroomName(q);
        if (!qName) throw badRequest("QUERY_INVALID");
    }

    const geohashPrefixes = parseGeohashPrefixes(filters);
    if (geohashPrefixes.length > 0 && qName) {
        throw badRequest("QUERY_INVALID");
    }

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

    return {
        raw: filters,
        qName,
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
