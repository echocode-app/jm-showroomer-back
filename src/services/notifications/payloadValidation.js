import { badRequest } from "../../core/error.js";
import { NOTIFICATION_TYPES } from "./types.js";

function asPlainObject(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return {};
    }
    return payload;
}

function asOptionalString(value, maxLength = 200) {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    if (!str) return null;
    return str.slice(0, maxLength);
}

function asOptionalIso(value) {
    const str = asOptionalString(value, 64);
    if (!str) return null;
    const parsed = Date.parse(str);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
}

function sanitizeShowroomPayload(payload) {
    const showroomName = asOptionalString(payload.showroomName);
    const reason = asOptionalString(payload.reason, 400);
    const deletedAt = asOptionalIso(payload.deletedAt);
    return {
        showroomName,
        reason,
        deletedAt,
    };
}

function sanitizeLookbookPayload(payload) {
    return {
        lookbookName: asOptionalString(payload.lookbookName),
    };
}

function sanitizeEventPayload(payload) {
    return {
        eventName: asOptionalString(payload.eventName),
    };
}

export function sanitizeNotificationPayload(type, payload) {
    const input = asPlainObject(payload);
    switch (type) {
        case NOTIFICATION_TYPES.SHOWROOM_APPROVED:
        case NOTIFICATION_TYPES.SHOWROOM_REJECTED:
        case NOTIFICATION_TYPES.SHOWROOM_DELETED_BY_ADMIN:
        case NOTIFICATION_TYPES.SHOWROOM_FAVORITED:
            return sanitizeShowroomPayload(input);
        case NOTIFICATION_TYPES.LOOKBOOK_FAVORITED:
            return sanitizeLookbookPayload(input);
        case NOTIFICATION_TYPES.EVENT_WANT_TO_VISIT:
            return sanitizeEventPayload(input);
        default:
            throw badRequest("NOTIFICATION_TYPE_INVALID");
    }
}
