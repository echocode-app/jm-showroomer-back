import { buildAnalyticsEvent } from "../analyticsEventBuilder.js";
import { ANALYTICS_EVENTS } from "../eventNames.js";

describe("analyticsEventBuilder", () => {
    it("builds canonical event with defaults", () => {
        const event = buildAnalyticsEvent({
            eventName: ANALYTICS_EVENTS.SHOWROOM_VIEW,
            source: "server",
            actor: { userId: "u1", isAnonymous: false },
            context: { surface: "showroom_detail" },
            resource: { type: "showroom", id: "s1" },
            meta: { producer: "backend_api" },
        });

        expect(typeof event.eventId).toBe("string");
        expect(event.eventId.length).toBeGreaterThan(0);
        expect(event.schemaVersion).toBe(1);
        expect(event.eventVersion).toBe(1);
        expect(event.meta.sampleRate).toBe(1);
        expect(event.user.actorId.startsWith("u:")).toBe(true);
    });

    it("builds canonical anonymous actorId", () => {
        const event = buildAnalyticsEvent({
            eventName: ANALYTICS_EVENTS.EVENT_VIEW,
            source: "server",
            actor: { anonymousId: "anon-1", isAnonymous: true },
            context: { surface: "event_detail" },
            resource: { type: "event", id: "e1" },
        });

        expect(event.user.actorId.startsWith("a:")).toBe(true);
    });
});

