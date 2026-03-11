// Purpose: Build deterministic push payloads from stored notification documents.
// Responsibility: Keep notification-to-push text mapping centralized.
// Invariant: Mapping must be pure and side-effect free.
import { APP_LANGUAGES, normalizeAppLanguage } from "../../constants/appLanguage.js";

// =========================
// SECTION: Payload Mapping
// =========================

export function buildPushPayload({ type, resourceType, resourceId, notificationId, payload, locale }) {
    const { title, body } = resolvePushText(type, payload, locale);
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

const PUSH_TEXTS = Object.freeze({
    [APP_LANGUAGES.EN]: Object.freeze({
        SHOWROOM_APPROVED: "Your showroom was approved",
        SHOWROOM_REJECTED: "Your showroom was rejected",
        SHOWROOM_DELETED_BY_ADMIN: "Your showroom was deleted by moderator",
        SHOWROOM_FAVORITED: "New showroom follower",
        LOOKBOOK_FAVORITED: "Your lookbook was liked",
        EVENT_WANT_TO_VISIT: "Someone is interested in your event",
        DEFAULT: "New notification",
    }),
    [APP_LANGUAGES.UK]: Object.freeze({
        SHOWROOM_APPROVED: "Ваш шоурум схвалено модератором",
        SHOWROOM_REJECTED: "Ваш шоурум відхилено модератором",
        SHOWROOM_DELETED_BY_ADMIN: "Ваш шоурум було видалено модератором",
        SHOWROOM_FAVORITED: "Новий підписник шоуруму",
        LOOKBOOK_FAVORITED: "Ваш лукбук вподобали",
        EVENT_WANT_TO_VISIT: "Хтось зацікавився вашою подією",
        DEFAULT: "Нове сповіщення",
    }),
});

function resolvePushText(type, payload = {}, locale = null) {
    const language = normalizeAppLanguage(locale, APP_LANGUAGES.EN);
    const dict = PUSH_TEXTS[language] || PUSH_TEXTS[APP_LANGUAGES.EN];
    switch (type) {
        case "SHOWROOM_APPROVED":
            return {
                title: dict.SHOWROOM_APPROVED,
                body: payload.showroomName || "",
            };
        case "SHOWROOM_REJECTED":
            return {
                title: dict.SHOWROOM_REJECTED,
                body: payload.showroomName || "",
            };
        case "SHOWROOM_DELETED_BY_ADMIN":
            return {
                title: dict.SHOWROOM_DELETED_BY_ADMIN,
                body: payload.showroomName || "",
            };
        case "SHOWROOM_FAVORITED":
            return {
                title: dict.SHOWROOM_FAVORITED,
                body: payload.showroomName || "",
            };
        case "LOOKBOOK_FAVORITED":
            return {
                title: dict.LOOKBOOK_FAVORITED,
                body: payload.lookbookName || "",
            };
        case "EVENT_WANT_TO_VISIT":
            return {
                title: dict.EVENT_WANT_TO_VISIT,
                body: payload.eventName || "",
            };
        default:
            return {
                title: dict.DEFAULT,
                body: "",
            };
    }
}
