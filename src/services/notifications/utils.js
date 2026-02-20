import { Timestamp } from "firebase-admin/firestore";
import { badRequest } from "../../core/error.js";
import { parseClampedLimit } from "../../utils/pagination.js";
import { toIsoString } from "../../utils/timestamp.js";

// Purpose: Reusable notification-domain parsing and normalization helpers.
// Responsibility: Cursor/limit validation and timestamp ISO conversions.
// Invariant: Cursors are backend-owned and versioned.

const CURSOR_VERSION = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// =========================
// SECTION: Limit Handling
// =========================

export function parseLimit(value) {
    // Clamp defensive limits to avoid unbounded reads in Firestore.
    return parseClampedLimit(value, {
        defaultValue: DEFAULT_LIMIT,
        maxValue: MAX_LIMIT,
        errorCode: "QUERY_INVALID",
    });
}

// =========================
// SECTION: Cursor Handling
// =========================

export function decodeCursor(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        if (
            !parsed ||
            parsed.v !== CURSOR_VERSION ||
            typeof parsed.createdAt !== "string" ||
            !parsed.createdAt ||
            typeof parsed.id !== "string" ||
            !parsed.id
        ) {
            throw badRequest("CURSOR_INVALID");
        }

        const date = new Date(parsed.createdAt);
        if (Number.isNaN(date.getTime())) {
            throw badRequest("CURSOR_INVALID");
        }

        return {
            createdAtTs: Timestamp.fromDate(date),
            id: parsed.id,
        };
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}

export function encodeCursor(doc) {
    const createdAtIso = toISO(doc.get("createdAt"));
    if (!createdAtIso) {
        throw badRequest("CURSOR_INVALID");
    }

    return Buffer.from(
        JSON.stringify({
            v: CURSOR_VERSION,
            createdAt: createdAtIso,
            id: doc.id,
        })
    ).toString("base64");
}

// =========================
// SECTION: Timestamp Handling
// =========================

export function toISO(value) {
    // Normalize Firestore Timestamp/Date/string to API-safe ISO string.
    return toIsoString(value);
}
