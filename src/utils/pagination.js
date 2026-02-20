import { badRequest } from "../core/error.js";

// Purpose: Shared pagination and limit parsing helpers.
// Responsibility: Keep limit handling consistent across domains.
// Invariant: all invalid limit inputs map to a stable domain error code.

// =========================
// SECTION: Limit Parsing
// =========================

export function parseStrictLimit(value, { defaultValue, maxValue, errorCode = "QUERY_INVALID" }) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxValue) {
        throw badRequest(errorCode);
    }
    return parsed;
}

export function parseClampedLimit(value, { defaultValue, maxValue, errorCode = "QUERY_INVALID" }) {
    if (value === undefined || value === null || value === "") return defaultValue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw badRequest(errorCode);
    }
    const integer = Math.trunc(parsed);
    return Math.min(Math.max(integer || defaultValue, 1), maxValue);
}
