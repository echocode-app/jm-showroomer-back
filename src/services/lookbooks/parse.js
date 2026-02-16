import { badRequest } from "../../core/error.js";
import { normalizeCountry } from "../../constants/countries.js";
import { decodeListCursor, encodeListCursor, CURSOR_VERSION } from "./parseCursor.js";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const SYNC_MAX_IDS = 100;

export function parseLookbookListFilters(filters = {}) {
    // Public list requires both dimensions for stable product-facing catalog slices.
    const country = parseRequiredString(filters.country);
    const seasonKey = parseRequiredString(filters.seasonKey);

    return {
        limit: parseLimit(filters.limit, DEFAULT_LIMIT, MAX_LIMIT),
        cursor: filters.cursor ? decodeListCursor(filters.cursor) : null,
        countryNormalized: normalizeCountry(country),
        seasonKey: normalizeSeasonKey(seasonKey),
    };
}

export function parseCollectionLimit(filters = {}) {
    return {
        // Collections endpoints intentionally allow up to MAX_LIMIT by default.
        limit: parseLimit(filters.limit, MAX_LIMIT, MAX_LIMIT),
    };
}

export function parseSyncPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw badRequest("QUERY_INVALID");
    }

    const allowedKeys = new Set(["favoriteIds"]);
    const unknownKeys = Object.keys(payload).filter(key => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
        throw badRequest("QUERY_INVALID");
    }

    return {
        favoriteIds: parseIdsList(payload.favoriteIds),
    };
}

export function parseLimit(value, defaultValue, maxValue) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxValue) {
        throw badRequest("QUERY_INVALID");
    }
    return parsed;
}

function parseRequiredString(value) {
    if (value === undefined || value === null) {
        throw badRequest("QUERY_INVALID");
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
        throw badRequest("QUERY_INVALID");
    }

    return trimmed;
}

function normalizeSeasonKey(value) {
    return value.trim().toLowerCase();
}

function parseIdsList(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw badRequest("QUERY_INVALID");
    }
    if (value.length > SYNC_MAX_IDS) {
        throw badRequest("LOOKBOOK_SYNC_LIMIT_EXCEEDED");
    }

    // Preserve input order while deduplicating IDs.
    const normalized = [];
    const seen = new Set();

    for (const raw of value) {
        if (typeof raw !== "string") {
            throw badRequest("QUERY_INVALID");
        }

        const id = raw.trim();
        if (!id) {
            throw badRequest("QUERY_INVALID");
        }

        if (!seen.has(id)) {
            normalized.push(id);
            seen.add(id);
        }
    }

    return normalized;
}

export { encodeListCursor, decodeListCursor, CURSOR_VERSION };
