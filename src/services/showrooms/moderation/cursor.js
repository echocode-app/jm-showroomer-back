import { badRequest } from "../../../core/error.js";
import { toIsoString } from "../../../utils/timestamp.js";
import { Timestamp } from "firebase-admin/firestore";
import {
    MODERATION_CURSOR_VERSION,
    MODERATION_DIRECTION,
    MODERATION_MODE,
    MODERATION_ORDER_FIELD,
    MODERATION_STATUS,
} from "./constants.js";

// Cursor fingerprint is part of the moderation queue contract.
// It prevents replaying a cursor under another mode/order/status and causing paging drift.
export function assertModerationCursorFingerprint(cursor, { status } = {}) {
    const expectedStatus = status ?? MODERATION_STATUS;
    if (
        cursor.mode !== MODERATION_MODE ||
        cursor.status !== expectedStatus ||
        cursor.orderField !== MODERATION_ORDER_FIELD ||
        cursor.direction !== MODERATION_DIRECTION
    ) {
        throw badRequest("CURSOR_INVALID");
    }
}

export function buildModerationCursor({ status, lastValue, id }) {
    if (!id) return null;

    const payload = {
        v: MODERATION_CURSOR_VERSION,
        mode: MODERATION_MODE,
        status: status ?? MODERATION_STATUS,
        orderField: MODERATION_ORDER_FIELD,
        direction: MODERATION_DIRECTION,
        lastValue: serializeCursorValue(lastValue),
        id,
    };

    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodeModerationCursor(cursor) {
    if (!cursor || typeof cursor !== "string") {
        throw badRequest("CURSOR_INVALID");
    }

    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
        if (!parsed || typeof parsed !== "object") {
            throw badRequest("CURSOR_INVALID");
        }
        if (
            parsed.v !== MODERATION_CURSOR_VERSION ||
            typeof parsed.mode !== "string" ||
            typeof parsed.status !== "string" ||
            typeof parsed.orderField !== "string" ||
            (parsed.direction !== "asc" && parsed.direction !== "desc") ||
            parsed.lastValue === undefined ||
            !parsed.id
        ) {
            throw badRequest("CURSOR_INVALID");
        }

        return {
            ...parsed,
            lastValue: deserializeCursorValue(parsed.lastValue),
        };
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}

function serializeCursorValue(value) {
    if (isTimestampLike(value)) {
        const iso = toIsoString(value);
        if (!iso) return value;
        return { kind: "ts", iso };
    }
    if (typeof value === "string") {
        const iso = toIsoString(value);
        return { kind: "str", iso: iso ?? value };
    }
    return value;
}

function deserializeCursorValue(value) {
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

export const MODERATION_CURSOR_SCHEMA = {
    version: MODERATION_CURSOR_VERSION,
    mode: MODERATION_MODE,
    status: MODERATION_STATUS,
    orderField: MODERATION_ORDER_FIELD,
    direction: MODERATION_DIRECTION,
};

// Backward-compatible aliases for already-added tests/imports.
export const encodeAdminModerationCursor = buildModerationCursor;
export const decodeAdminModerationCursor = decodeModerationCursor;
export const assertAdminModerationCursorFingerprint = assertModerationCursorFingerprint;
export const ADMIN_MODERATION_CURSOR = MODERATION_CURSOR_SCHEMA;

