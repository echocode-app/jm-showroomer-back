// Purpose: Build deterministic push payloads from stored notification documents.
// Responsibility: Keep notification-to-push text mapping centralized.
// Invariant: Mapping must be pure and side-effect free.

// =========================
// SECTION: Payload Mapping
// =========================

export function buildPushPayload({ type, resourceType, resourceId, notificationId, payload }) {
    const { title, body } = resolvePushText(type, payload);
    return {
        notification: {
            title,
            body,
        },
        data: {
            type,
            resourceType,
            resourceId,
            notificationId,
        },
    };
}

function resolvePushText(type, payload = {}) {
    switch (type) {
        case "SHOWROOM_APPROVED":
            return {
                title: "Your showroom was approved",
                body: payload.showroomName || "",
            };
        case "SHOWROOM_REJECTED":
            return {
                title: "Your showroom was rejected",
                body: payload.showroomName || "",
            };
        case "SHOWROOM_FAVORITED":
            return {
                title: "New showroom follower",
                body: payload.showroomName || "",
            };
        case "LOOKBOOK_FAVORITED":
            return {
                title: "Your lookbook was liked",
                body: payload.lookbookName || "",
            };
        case "EVENT_WANT_TO_VISIT":
            return {
                title: "Someone is interested in your event",
                body: payload.eventName || "",
            };
        default:
            return {
                title: "New notification",
                body: "",
            };
    }
}
