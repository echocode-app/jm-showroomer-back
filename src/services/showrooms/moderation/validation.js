import { badRequest } from "../../../core/error.js";
import { parseLimit } from "../list/parse/lists.js";
import {
    ADMIN_SHOWROOM_STATUSES,
    MODERATION_ALLOWED_QUERY_KEYS,
    MODERATION_STATUS,
} from "./constants.js";
import {
    assertModerationCursorFingerprint,
    decodeModerationCursor,
} from "./cursor.js";

// Admin list now requires an explicit status filter.
// This avoids accidental "all statuses" reads in moderation surfaces.
export function parseAdminShowroomsStatus(filters = {}) {
    const raw = filters?.status;
    if (raw === undefined || raw === null || raw === "") {
        throw badRequest("QUERY_INVALID");
    }
    if (Array.isArray(raw)) {
        throw badRequest("QUERY_INVALID");
    }

    const status = String(raw).trim().toLowerCase();
    if (!ADMIN_SHOWROOM_STATUSES.has(status)) {
        throw badRequest("QUERY_INVALID");
    }
    return status;
}

export function parseModerationQueueQuery(filters = {}) {
    for (const key of Object.keys(filters)) {
        if (!MODERATION_ALLOWED_QUERY_KEYS.has(key)) {
            throw badRequest("QUERY_INVALID");
        }
    }

    const status = parseAdminShowroomsStatus(filters);
    if (status !== MODERATION_STATUS) {
        throw badRequest("QUERY_INVALID");
    }

    const limit = parseLimit(filters.limit);
    const cursor = filters.cursor ? decodeModerationCursor(filters.cursor) : null;
    if (cursor) {
        assertModerationCursorFingerprint(cursor, { status });
    }

    return { status, limit, cursor };
}

// Backward-compatible alias for existing imports.
export const parseAdminModerationQueueQuery = parseModerationQueueQuery;

