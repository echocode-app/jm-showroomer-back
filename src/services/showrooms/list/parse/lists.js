// Parsing helpers for common list params (limits, lists, enums).

import { badRequest } from "../../../../core/error.js";
import { normalizeKey } from "../../../../utils/showroomValidation.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "./constants.js";

export function parseLimit(value) {
    // Limit is parsed once and reused by every list mode (default/name/geohash).
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

export function parseFields(value) {
    // `marker` keeps payload small for map pins, `card` keeps full list card data.
    if (value === undefined || value === null || value === "") {
        return "card";
    }
    const mode = String(value).toLowerCase();
    if (mode === "marker" || mode === "card") return mode;
    throw badRequest("QUERY_INVALID");
}

export function parseQMode(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const mode = String(value).toLowerCase();
    if (mode === "city" || mode === "name") return mode;
    throw badRequest("QUERY_INVALID");
}

export function parseList(value) {
    // Supports both repeated query params and comma-separated strings.
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

export function parseType(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const normalized = normalizeKey(value);
    if (normalized === "unique" || normalized === "multibrand") {
        return normalized;
    }
    throw badRequest("QUERY_INVALID");
}
