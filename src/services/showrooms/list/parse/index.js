// Showroom list query parsing entrypoint.

import { badRequest } from "../../../../core/error.js";
import {
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MAX_SCAN,
    MAX_GEO_PREFIXES,
    CURSOR_VERSION,
} from "./constants.js";
import {
    parseLimit,
    parseFields,
    parseQMode,
    parseList,
    parseType,
} from "./lists.js";
import {
    parseBrandFilter,
    parseCategoryGroups,
    parseSubcategories,
    parseCityAndQName,
    parseGeohashPrefixes,
} from "./filters.js";
import { decodeCursor, encodeCursor, assertCursorMatchesMode } from "./cursor.js";

export {
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MAX_SCAN,
    MAX_GEO_PREFIXES,
    CURSOR_VERSION,
    decodeCursor,
    encodeCursor,
};

export function parseFilters(filters = {}) {
    const limit = parseLimit(filters.limit);
    const fields = parseFields(filters.fields);
    const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;

    const qMode = parseQMode(filters.qMode);
    const { cityNormalized, qName } = parseCityAndQName(filters, qMode);

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
    const geohashPrefixes = parseGeohashPrefixes(filters);
    const hasGeohash = geohashPrefixes.length > 0;
    const hasMultiPrefix = geohashPrefixes.length > 1;

    if (hasGeohash && qName) {
        throw badRequest("QUERY_INVALID");
    }

    const cursorDisabled = hasMultiPrefix;
    if (cursor && cursorDisabled) {
        throw badRequest("QUERY_INVALID");
    }
    if (cursor) {
        assertCursorMatchesMode(cursor, geohashPrefixes, qName);
    }

    return {
        raw: filters,
        limit,
        fields,
        cursor,
        cityNormalized,
        qName,
        brandKey,
        brandNormalized,
        type,
        categoryGroups,
        subcategories,
        categories,
        geohashPrefixes,
        cursorDisabled,
        hasGeohash,
        hasMultiPrefix,
        qMode,
    };
}
