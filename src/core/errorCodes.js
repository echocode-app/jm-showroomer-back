export const ERROR_STATUS = {
    AUTH_MISSING: 401,
    AUTH_INVALID: 401,
    NO_AUTH: 401,

    FORBIDDEN: 403,
    ACCESS_DENIED: 403,
    COUNTRY_BLOCKED: 403,

    USER_NOT_FOUND: 404,
    SHOWROOM_NOT_FOUND: 404,
    LOOKBOOK_NOT_FOUND: 404,
    EVENT_NOT_FOUND: 404,
    NOT_FOUND: 404,

    VALIDATION_ERROR: 400,
    ID_TOKEN_REQUIRED: 400,
    SHOWROOM_NAME_REQUIRED: 400,
    SHOWROOM_TYPE_REQUIRED: 400,
    COUNTRY_REQUIRED: 400,
    SHOWROOM_NAME_INVALID: 400,
    SHOWROOM_CATEGORY_GROUP_INVALID: 400,
    SHOWROOM_SUBCATEGORY_INVALID: 400,
    SHOWROOM_SUBCATEGORY_GROUP_MISMATCH: 400,
    INSTAGRAM_INVALID: 400,
    PHONE_INVALID: 400,
    SHOWROOM_INCOMPLETE: 400,
    SHOWROOM_NOT_EDITABLE: 400,
    SHOWROOM_NAME_ALREADY_EXISTS: 400,
    SHOWROOM_DUPLICATE: 400,
    NO_FIELDS_TO_UPDATE: 400,
    QUERY_INVALID: 400,
    EVENT_SYNC_LIMIT_EXCEEDED: 400,
    LOOKBOOK_SYNC_LIMIT_EXCEEDED: 400,
    LOOKBOOK_FORBIDDEN: 403,
    SHOWROOM_ID_INVALID: 400,
    ANON_ID_INVALID: 400,
    NOTIFICATION_TYPE_INVALID: 400,
    CURSOR_INVALID: 400,
    INDEX_NOT_READY: 503,
    EVENTS_WRITE_MVP2_ONLY: 501,
    SHOWROOM_LOCKED_PENDING: 409,
    SHOWROOM_PENDING_SNAPSHOT_MISSING: 409,
    USER_COUNTRY_CHANGE_BLOCKED: 409,
    USER_DELETE_BLOCKED: 409,

    LOAD_USER_ERROR: 500,
    AUTH_ERROR: 500,
    NOT_IMPLEMENTED: 501,
};

export const ERROR_MESSAGE = {
    AUTH_MISSING: "Authorization token missing",
    AUTH_INVALID: "Invalid or expired token",
    NO_AUTH: "Auth info missing",
    ID_TOKEN_REQUIRED: "Missing idToken",
    FORBIDDEN: "Access denied",
    COUNTRY_BLOCKED: "Country is not supported",
    USER_NOT_FOUND: "User profile not found",
    LOOKBOOK_NOT_FOUND: "Lookbook not found",
    EVENT_NOT_FOUND: "Event not found",
    NOT_FOUND: "Not found",
    VALIDATION_ERROR: "Validation error",
    QUERY_INVALID: "Query parameters are invalid",
    EVENT_SYNC_LIMIT_EXCEEDED: "Guest event sync limit exceeded",
    LOOKBOOK_SYNC_LIMIT_EXCEEDED: "Guest lookbook sync limit exceeded",
    LOOKBOOK_FORBIDDEN: "You do not have access to modify this lookbook",
    SHOWROOM_ID_INVALID: "showroomId is invalid",
    ANON_ID_INVALID: "x-anonymous-id is invalid",
    NOTIFICATION_TYPE_INVALID: "Notification type is invalid",
    CURSOR_INVALID: "Cursor is invalid",
    INDEX_NOT_READY: "Search temporarily unavailable. Please retry later.",
    EVENTS_WRITE_MVP2_ONLY: "Events write endpoints are available in MVP2",
    SHOWROOM_LOCKED_PENDING: "Showroom is under review",
    SHOWROOM_PENDING_SNAPSHOT_MISSING: "Pending snapshot missing; cannot approve",
    SHOWROOM_CATEGORY_GROUP_INVALID: "Category group is invalid",
    SHOWROOM_SUBCATEGORY_INVALID: "Subcategory is invalid",
    SHOWROOM_SUBCATEGORY_GROUP_MISMATCH: "Subcategories require clothing group",
    USER_COUNTRY_CHANGE_BLOCKED:
        "To change country, delete your showrooms and lookbooks or create a new account",
    USER_DELETE_BLOCKED: "Delete your showrooms before deleting your account.",
};

// getStatusForCode
export function getStatusForCode(code) {
    return ERROR_STATUS[code];
}

// getMessageForCode
export function getMessageForCode(code, fallback) {
    return ERROR_MESSAGE[code] ?? fallback ?? code;
}
