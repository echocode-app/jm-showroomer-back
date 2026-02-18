import { badRequest } from "../../core/error.js";

export const NOTIFICATION_TYPES = Object.freeze({
    SHOWROOM_APPROVED: "SHOWROOM_APPROVED",
    SHOWROOM_REJECTED: "SHOWROOM_REJECTED",
    SHOWROOM_FAVORITED: "SHOWROOM_FAVORITED",
    LOOKBOOK_FAVORITED: "LOOKBOOK_FAVORITED",
    EVENT_WANT_TO_VISIT: "EVENT_WANT_TO_VISIT",
});

export function assertValidNotificationType(type) {
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
        throw badRequest("NOTIFICATION_TYPE_INVALID");
    }
}
