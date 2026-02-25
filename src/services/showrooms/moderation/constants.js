// Admin moderation queue constants are isolated from the public list engine.
// This keeps queue paging semantics stable even if public search grammar evolves.

export const MODERATION_MODE = "moderation";
export const MODERATION_STATUS = "pending";
export const MODERATION_ORDER_FIELD = "submittedAt";
export const MODERATION_DIRECTION = "desc";
export const MODERATION_CURSOR_VERSION = 3;

export const ADMIN_SHOWROOM_STATUSES = new Set([
    "draft",
    "pending",
    "approved",
    "rejected",
    "deleted",
]);

// Admin moderation queue is intentionally narrow:
// only explicit filter + paging params are accepted.
export const MODERATION_ALLOWED_QUERY_KEYS = new Set(["status", "limit", "cursor"]);

