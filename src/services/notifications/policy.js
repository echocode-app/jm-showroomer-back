import { log } from "../../config/logger.js";

// Purpose: Centralized notification-type gating policy.
// Responsibility: Resolve env-driven enable/disable rules for notification types.
// Invariant: unknown types fallback to enabled to avoid accidental delivery loss.

export const NOTIFICATION_POLICY = Object.freeze({
    SHOWROOM_APPROVED: true,
    SHOWROOM_REJECTED: true,
    SHOWROOM_FAVORITED: true,
    LOOKBOOK_FAVORITED: () => process.env.MVP_MODE !== "true",
    EVENT_WANT_TO_VISIT: () => process.env.MVP_MODE !== "true",
});

export function isNotificationTypeEnabled(type) {
    const entry = NOTIFICATION_POLICY[type];
    if (entry === undefined) {
        if (isDevelopmentEnv()) {
            log.info(`Notification policy fallback=enabled for unknown type=${type}`);
        }
        return true;
    }
    return typeof entry === "function" ? Boolean(entry()) : Boolean(entry);
}

function isDevelopmentEnv() {
    const env = String(process.env.NODE_ENV || "").toLowerCase();
    return env === "dev" || env === "development";
}
