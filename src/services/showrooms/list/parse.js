// Showroom list parse helpers.

// Showroom list query parsing and validation.
import { badRequest } from "../../../core/error.js";
import { normalizeCity } from "../../../utils/geoValidation.js";
import {
    normalizeBrand,
    normalizeShowroomName,
} from "../../../utils/showroomValidation.js";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const MAX_SCAN = 200;
export const MAX_GEO_PREFIXES = 8;
export const CURSOR_VERSION = 1;

export function parseFilters(filters = {}) {
    const limit = parseLimit(filters.limit);
    const fields = parseFields(filters.fields);
    const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;

    let cityNormalized = null;
    let qName = null;
    const qMode = parseQMode(filters.qMode);

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

    let brandNormalized = null;
    if (filters.brand !== undefined) {
        const normalized = normalizeBrand(filters.brand);
        if (!normalized) throw badRequest("QUERY_INVALID");
        brandNormalized = normalized;
    }
    const categories = parseList(filters.categories);
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

    const cursorDisabled =
        geohashPrefixes.length > 1 || (geohashPrefixes.length > 0 && !!qName);
    if (cursor && cursorDisabled) {
        throw badRequest("QUERY_INVALID");
    }

    return {
        raw: filters,
        limit,
        fields,
        cursor,
        cityNormalized,
        qName,
        brandNormalized,
        categories,
        geohashPrefixes,
        cursorDisabled,
        qMode,
    };
}

function parseLimit(value) {
    if (value === undefined || value === null || value === "") {
        return DEFAULT_LIMIT;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw badRequest("QUERY_INVALID");
    }
    if (parsed < 1 || parsed > MAX_LIMIT) {
        throw badRequest("QUERY_INVALID");
    }
    return parsed;
}

function parseFields(value) {
    if (value === undefined || value === null || value === "") {
        return "card";
    }
    const mode = String(value).toLowerCase();
    if (mode === "marker" || mode === "card") return mode;
    throw badRequest("QUERY_INVALID");
}

function parseQMode(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const mode = String(value).toLowerCase();
    if (mode === "city" || mode === "name") return mode;
    throw badRequest("QUERY_INVALID");
}

function parseList(value) {
    if (Array.isArray(value)) {
        return value.map(v => String(v).trim()).filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);
    }
    return [];
}

export function decodeCursor(cursor) {
    if (!cursor || typeof cursor !== "string") {
        throw badRequest("CURSOR_INVALID");
    }
    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
        if (!parsed || typeof parsed !== "object") {
            throw badRequest("CURSOR_INVALID");
        }
        if (parsed.v !== CURSOR_VERSION) {
            throw badRequest("CURSOR_INVALID");
        }
        if (parsed.value === undefined || !parsed.id) {
            throw badRequest("CURSOR_INVALID");
        }
        return parsed;
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}

export function encodeCursor(value) {
    if (!value) return null;
    return Buffer.from(
        JSON.stringify({ v: CURSOR_VERSION, value: value.value, id: value.id })
    ).toString("base64");
}
