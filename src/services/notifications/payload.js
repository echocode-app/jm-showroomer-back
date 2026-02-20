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
                title: "Ваш шоурум схвалено",
                body: payload.showroomName || "",
            };
        case "SHOWROOM_REJECTED":
            return {
                title: "Ваш шоурум відхилено",
                body: payload.showroomName || "",
            };
        case "SHOWROOM_FAVORITED":
            return {
                title: "Новий підписник шоуруму",
                body: payload.showroomName || "",
            };
        case "LOOKBOOK_FAVORITED":
            return {
                title: "Ваш лукбук сподобався",
                body: payload.lookbookName || "",
            };
        case "EVENT_WANT_TO_VISIT":
            return {
                title: "Хтось зацікавився івентом",
                body: payload.eventName || "",
            };
        default:
            return {
                title: "Нове сповіщення",
                body: "",
            };
    }
}
