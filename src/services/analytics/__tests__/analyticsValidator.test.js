import { validateAnalyticsIngestPayload } from "../analyticsValidator.js";
import { ANALYTICS_EVENTS } from "../eventNames.js";

describe("analyticsValidator", () => {
    it("rejects unknown event with 400", () => {
        try {
            validateAnalyticsIngestPayload({
                events: [
                    {
                        eventName: "random_event",
                        context: {},
                        resource: {},
                        meta: {},
                    },
                ],
            });
        } catch (err) {
            expect(err.code).toBe("EVENT_NAME_INVALID");
            expect(err.status).toBe(400);
            return;
        }

        throw new Error("Expected validator to throw");
    });

    it("accepts registered event names", () => {
        const result = validateAnalyticsIngestPayload({
            events: [
                {
                    eventName: ANALYTICS_EVENTS.SHOWROOM_VIEW,
                    context: {},
                    resource: {},
                    meta: {},
                },
            ],
        });

        expect(result.events).toHaveLength(1);
    });
});

