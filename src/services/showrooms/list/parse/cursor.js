// Cursor encode/decode + mode safety for list pagination.

import { badRequest } from "../../../../core/error.js";
import { Timestamp } from "firebase-admin/firestore";
import { CURSOR_VERSION } from "./constants.js";

export function decodeCursor(cursor) {
    if (!cursor || typeof cursor !== "string") {
        throw badRequest("CURSOR_INVALID");
    }
    try {
        // Cursor is server-issued base64 JSON; any malformed/partial payload is rejected.
        const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
        if (!parsed || typeof parsed !== "object") {
            throw badRequest("CURSOR_INVALID");
        }
        if (parsed.v === 2) {
            // v2 is strict: ordering field + direction are part of the contract.
            if (
                typeof parsed.f !== "string" ||
                !parsed.f ||
                (parsed.d !== "asc" && parsed.d !== "desc") ||
                parsed.value === undefined ||
                !parsed.id
            ) {
                throw badRequest("CURSOR_INVALID");
            }
            return normalizeDecodedCursor(parsed);
        }
        if (parsed.v === 1) {
            // v1 is legacy and accepted only in default ordering mode.
            if (parsed.value === undefined || !parsed.id) {
                throw badRequest("CURSOR_INVALID");
            }
            return normalizeDecodedCursor(parsed);
        }
        throw badRequest("CURSOR_INVALID");
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}

export function encodeCursor(value, orderField, direction) {
    if (!value) return null;
    if (!orderField || !direction) return null;
    return Buffer.from(
        // Cursor stores both sorting key and document id for deterministic continuation.
        JSON.stringify({
            v: CURSOR_VERSION,
            f: orderField,
            d: direction,
            value: serializeCursorValue(value.value, orderField),
            id: value.id,
        })
    ).toString("base64");
}

export function getExpectedOrdering(geohashPrefixes, qName) {
    // Ordering must stay mode-specific; cursor validation relies on this mapping.
    if (geohashPrefixes.length > 0) {
        return { orderField: "geo.geohash", direction: "asc" };
    }
    if (qName) {
        return { orderField: "nameNormalized", direction: "asc" };
    }
    return { orderField: "updatedAt", direction: "desc" };
}

export function assertCursorMatchesMode(cursor, geohashPrefixes, qName) {
    if (!cursor) return;
    const { orderField, direction } = getExpectedOrdering(geohashPrefixes, qName);
    if (cursor.v === 2) {
        // Reject cursor if client tries to replay it in a different filter/order mode.
        if (cursor.f !== orderField || cursor.d !== direction) {
            throw badRequest("CURSOR_INVALID");
        }
        return;
    }
    if (cursor.v === 1) {
        if (
            geohashPrefixes.length > 0 ||
            qName ||
            orderField !== "updatedAt" ||
            direction !== "desc"
        ) {
            throw badRequest("CURSOR_INVALID");
        }
        return;
    }
    throw badRequest("CURSOR_INVALID");
}

function normalizeDecodedCursor(cursor) {
    return {
        ...cursor,
        value: deserializeCursorValue(cursor.value, cursor.f),
    };
}

function serializeCursorValue(value, orderField) {
    if (orderField !== "updatedAt") {
        return value;
    }
    if (isTimestampLike(value)) {
        const iso = toIsoIfDateLike(value);
        if (!iso) return value;
        return { kind: "ts", iso };
    }
    if (typeof value === "string") {
        const iso = toIsoIfDateLike(value);
        return { kind: "str", iso: iso ?? value };
    }
    return value;
}

function deserializeCursorValue(value, orderField) {
    if (orderField !== "updatedAt") {
        return value;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
        if (value.kind === "ts" && typeof value.iso === "string") {
            const ms = Date.parse(value.iso);
            if (Number.isFinite(ms)) {
                return Timestamp.fromDate(new Date(ms));
            }
            return value.iso;
        }
        if (value.kind === "str" && typeof value.iso === "string") {
            return value.iso;
        }
    }
    return value;
}

function isTimestampLike(value) {
    if (!value) return false;
    if (value instanceof Date) return true;
    if (value instanceof Timestamp) return true;
    if (typeof value?.toDate === "function") {
        const date = value.toDate();
        return date instanceof Date;
    }
    return false;
}

function toIsoIfDateLike(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (typeof value === "string") {
        const ms = Date.parse(value);
        if (Number.isFinite(ms)) {
            return new Date(ms).toISOString();
        }
    }
    return null;
}
