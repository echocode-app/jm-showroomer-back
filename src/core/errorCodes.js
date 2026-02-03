export const ERROR_STATUS = {
    AUTH_MISSING: 401,
    AUTH_INVALID: 401,
    NO_AUTH: 401,

    FORBIDDEN: 403,
    ACCESS_DENIED: 403,
    COUNTRY_BLOCKED: 403,

    USER_NOT_FOUND: 404,
    SHOWROOM_NOT_FOUND: 404,
    NOT_FOUND: 404,

    VALIDATION_ERROR: 400,
    SHOWROOM_NAME_REQUIRED: 400,
    SHOWROOM_TYPE_REQUIRED: 400,
    COUNTRY_REQUIRED: 400,
    SHOWROOM_NAME_INVALID: 400,
    INSTAGRAM_INVALID: 400,
    PHONE_INVALID: 400,
    SHOWROOM_INCOMPLETE: 400,
    SHOWROOM_NOT_EDITABLE: 400,
    SHOWROOM_NAME_ALREADY_EXISTS: 400,
    SHOWROOM_DUPLICATE: 400,
    NO_FIELDS_TO_UPDATE: 400,
    SHOWROOM_LOCKED_PENDING: 409,
    SHOWROOM_PENDING_SNAPSHOT_MISSING: 409,
    USER_COUNTRY_CHANGE_BLOCKED: 409,

    LOAD_USER_ERROR: 500,
    AUTH_ERROR: 500,
    NOT_IMPLEMENTED: 501,
};

export const ERROR_MESSAGE = {
    AUTH_MISSING: "Authorization token missing",
    AUTH_INVALID: "Invalid or expired token",
    NO_AUTH: "Auth info missing",
    FORBIDDEN: "Access denied",
    COUNTRY_BLOCKED: "Country is not supported",
    USER_NOT_FOUND: "User profile not found",
    NOT_FOUND: "Not found",
    VALIDATION_ERROR: "Validation error",
    SHOWROOM_LOCKED_PENDING: "Showroom is under review",
    SHOWROOM_PENDING_SNAPSHOT_MISSING: "Pending snapshot missing; cannot approve",
    USER_COUNTRY_CHANGE_BLOCKED:
        "To change country, delete your showrooms and lookbooks or create a new account",
};

// getStatusForCode
export function getStatusForCode(code) {
    return ERROR_STATUS[code];
}

// getMessageForCode
export function getMessageForCode(code, fallback) {
    return ERROR_MESSAGE[code] ?? fallback ?? code;
}
