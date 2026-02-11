import { Timestamp } from "firebase-admin/firestore";
import { badRequest } from "../../core/error.js";

export const DEFAULT_LIMIT = 20;
export const COLLECTION_DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 100;
export const LIST_CURSOR_VERSION = 1;

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
