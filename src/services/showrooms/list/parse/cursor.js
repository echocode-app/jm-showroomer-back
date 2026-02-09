// Cursor encode/decode + mode safety for list pagination.

import { badRequest } from "../../../../core/error.js";
import { CURSOR_VERSION } from "./constants.js";

export function decodeCursor(cursor) {
    if (!cursor || typeof cursor !== "string") {
        throw badRequest("CURSOR_INVALID");
    }
    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
        if (!parsed || typeof parsed !== "object") {
            throw badRequest("CURSOR_INVALID");
        }
        if (parsed.v === 2) {
            if (
                typeof parsed.f !== "string" ||
                !parsed.f ||
                (parsed.d !== "asc" && parsed.d !== "desc") ||
                parsed.value === undefined ||
                !parsed.id
            ) {
                throw badRequest("CURSOR_INVALID");
            }
            return parsed;
        }
        if (parsed.v === 1) {
            if (parsed.value === undefined || !parsed.id) {
                throw badRequest("CURSOR_INVALID");
            }
            return parsed;
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
        JSON.stringify({
            v: CURSOR_VERSION,
            f: orderField,
            d: direction,
            value: value.value,
            id: value.id,
        })
    ).toString("base64");
}

export function getExpectedOrdering(geohashPrefixes, qName) {
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
