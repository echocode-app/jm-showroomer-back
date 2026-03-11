import { sanitizeNotificationPayload } from "../payloadValidation.js";
import { buildPushPayload } from "../payload.js";

describe("notification payload validation", () => {
    it("sanitizes showroom payload and keeps only allowed fields", () => {
        const payload = sanitizeNotificationPayload("SHOWROOM_REJECTED", {
            showroomName: "  Atelier Nova  ",
            reason: "  Invalid data  ",
            deletedAt: "invalid-date",
            extra: "drop-me",
        });

        expect(payload).toEqual({
            showroomName: "Atelier Nova",
            reason: "Invalid data",
            deletedAt: null,
        });
    });

    it("normalizes deletedAt to ISO when valid", () => {
        const payload = sanitizeNotificationPayload("SHOWROOM_DELETED_BY_ADMIN", {
            showroomName: "A",
            deletedAt: "2026-03-04T12:00:00.000Z",
        });

        expect(payload.deletedAt).toBe("2026-03-04T12:00:00.000Z");
    });
});

describe("notification push localization", () => {
    it("uses uk localization when locale is ua alias", () => {
        const push = buildPushPayload({
            type: "SHOWROOM_DELETED_BY_ADMIN",
            resourceType: "showroom",
            resourceId: "sr-1",
            notificationId: "n-1",
            payload: { showroomName: "Atelier Nova" },
            locale: "ua",
        });

        expect(push.notification.title).toBe("Ваш шоурум було видалено модератором");
    });

    it("falls back to en localization for unknown locale", () => {
        const push = buildPushPayload({
            type: "SHOWROOM_APPROVED",
            resourceType: "showroom",
            resourceId: "sr-1",
            notificationId: "n-1",
            payload: { showroomName: "Atelier Nova" },
            locale: "de",
        });

        expect(push.notification.title).toBe("Your showroom was approved");
    });
});
