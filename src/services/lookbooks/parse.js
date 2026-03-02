import { badRequest } from "../../core/error.js";
import { normalizeCountry } from "../../constants/countries.js";
import { decodeListCursor, encodeListCursor, CURSOR_VERSION } from "./parseCursor.js";
import { parseStrictLimit } from "../../utils/pagination.js";
import { buildNearbyGeohashPrefixes } from "../showrooms/list/parse/nearby.js";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const SYNC_MAX_IDS = 100;

export function parseLookbookListFilters(filters = {}) {
    // Country remains required for MVP1 catalog partitioning.
    const country = parseRequiredString(filters.country);
    const seasonKey = parseOptionalString(filters.seasonKey);

    return {
        limit: parseLimit(filters.limit, DEFAULT_LIMIT, MAX_LIMIT),
        cursor: filters.cursor ? decodeListCursor(filters.cursor) : null,
        countryNormalized: normalizeCountry(country),
        seasonKey: seasonKey ? normalizeSeasonKey(seasonKey) : null,
        nearbyGeohashPrefixes: buildNearbyGeohashPrefixes(filters),
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
    return parseStrictLimit(value, {
        defaultValue,
        maxValue,
        errorCode: "QUERY_INVALID",
    });
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

function parseOptionalString(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
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
