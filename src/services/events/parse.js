import { Timestamp } from "firebase-admin/firestore";
import { badRequest } from "../../core/error.js";
import { parseStrictLimit } from "../../utils/pagination.js";

export const DEFAULT_LIMIT = 20;
export const COLLECTION_DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 100;
export const LIST_CURSOR_VERSION = 1;
export const COLLECTION_CURSOR_VERSION = 1;

export function parseListFilters(filters = {}) {
    return {
        limit: parseLimit(filters.limit, DEFAULT_LIMIT, MAX_LIMIT),
        cursor: filters.cursor ? decodeListCursor(filters.cursor) : null,
        country: parseOptionalString(filters.country),
        cityNormalized: parseCityNormalized(filters.city),
    };
}

export function parseCollectionFilters(filters = {}) {
    return {
        limit: parseLimit(filters.limit, COLLECTION_DEFAULT_LIMIT, MAX_LIMIT),
        cursor: filters.cursor ? decodeCollectionCursor(filters.cursor) : null,
    };
}

export function parseLimit(value, defaultValue, maxValue) {
    return parseStrictLimit(value, {
        defaultValue,
        maxValue,
        errorCode: "QUERY_INVALID",
    });
}

export function parseOptionalString(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) throw badRequest("QUERY_INVALID");
    return trimmed;
}

export function parseCityNormalized(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) throw badRequest("QUERY_INVALID");
    return trimmed.toLowerCase().replace(/\s+/g, " ");
}

export function encodeListCursor({ startsAtIso, id }) {
    // Backend-owned cursor format to prevent client-crafted paging drift.
    return Buffer.from(
        JSON.stringify({
            v: LIST_CURSOR_VERSION,
            startsAt: startsAtIso,
            id,
        })
    ).toString("base64");
}

export function decodeListCursor(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        // Strict contract check: only server-issued v1 cursor shape is accepted.
        if (
            !parsed ||
            parsed.v !== LIST_CURSOR_VERSION ||
            typeof parsed.startsAt !== "string" ||
            !parsed.startsAt ||
            typeof parsed.id !== "string" ||
            !parsed.id
        ) {
            throw badRequest("CURSOR_INVALID");
        }

        const ms = Date.parse(parsed.startsAt);
        if (!Number.isFinite(ms)) {
            throw badRequest("CURSOR_INVALID");
        }

        return {
            startsAtIso: new Date(ms).toISOString(),
            startsAtTs: Timestamp.fromDate(new Date(ms)),
            id: parsed.id,
        };
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}

export function encodeCollectionCursor({ createdAtIso, id }) {
    return Buffer.from(
        JSON.stringify({
            v: COLLECTION_CURSOR_VERSION,
            createdAt: createdAtIso,
            id,
        })
    ).toString("base64");
}

export function decodeCollectionCursor(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        if (
            !parsed ||
            parsed.v !== COLLECTION_CURSOR_VERSION ||
            typeof parsed.createdAt !== "string" ||
            !parsed.createdAt ||
            typeof parsed.id !== "string" ||
            !parsed.id
        ) {
            throw badRequest("CURSOR_INVALID");
        }

        const ms = Date.parse(parsed.createdAt);
        if (!Number.isFinite(ms)) {
            throw badRequest("CURSOR_INVALID");
        }

        return {
            createdAtIso: new Date(ms).toISOString(),
            id: parsed.id,
        };
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}
