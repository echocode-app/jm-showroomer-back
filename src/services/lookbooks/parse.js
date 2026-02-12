import { badRequest } from "../../core/error.js";
import { normalizeCountry } from "../../constants/countries.js";
import { Timestamp } from "firebase-admin/firestore";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const CURSOR_VERSION = 1;
export const SYNC_MAX_IDS = 100;

export function parseLookbookListFilters(filters = {}) {
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
        throw badRequest("EVENT_SYNC_LIMIT_EXCEEDED");
    }

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

export function encodeListCursor(cursor) {
    if (!cursor) return null;
    if (cursor.mode === "rank") {
        return Buffer.from(
            JSON.stringify({
                v: CURSOR_VERSION,
                m: "rank",
                r: cursor.sortRank,
                id: cursor.id,
            })
        ).toString("base64");
    }

    return Buffer.from(
        JSON.stringify({
            v: CURSOR_VERSION,
            m: "published",
            p: cursor.publishedAtIso,
            id: cursor.id,
        })
    ).toString("base64");
}

export function decodeListCursor(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        if (!parsed || parsed.v !== CURSOR_VERSION || typeof parsed.id !== "string" || !parsed.id) {
            throw badRequest("CURSOR_INVALID");
        }

        if (parsed.m === "rank") {
            if (!Number.isFinite(parsed.r)) {
                throw badRequest("CURSOR_INVALID");
            }

            return {
                mode: "rank",
                sortRank: Number(parsed.r),
                id: parsed.id,
            };
        }

        if (parsed.m === "published") {
            if (typeof parsed.p !== "string" || !parsed.p) {
                throw badRequest("CURSOR_INVALID");
            }

            const ms = Date.parse(parsed.p);
            if (!Number.isFinite(ms)) {
                throw badRequest("CURSOR_INVALID");
            }

            const iso = new Date(ms).toISOString();
            return {
                mode: "published",
                publishedAtIso: iso,
                publishedAtTs: Timestamp.fromDate(new Date(ms)),
                id: parsed.id,
            };
        }

        throw badRequest("CURSOR_INVALID");
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}
