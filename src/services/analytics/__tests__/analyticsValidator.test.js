import { validateAnalyticsIngestPayload } from "../analyticsValidator.js";
import { ANALYTICS_EVENTS } from "../eventNames.js";
import { jest } from "@jest/globals";

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

    it("warns in soft mode when resource identity is missing for view-like events", () => {
        const logger = { warn: jest.fn() };

        const result = validateAnalyticsIngestPayload(
            {
                events: [
                    {
                        eventName: ANALYTICS_EVENTS.SHOWROOM_VIEW,
                        context: { surface: "showroom_detail" },
                        resource: { type: "showroom" },
                        meta: {},
                    },
                ],
            },
            { logger }
        );

        expect(result.events).toHaveLength(1);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn.mock.calls[0][0]).toMatchObject({
            analyticsValidation: {
                code: "analytics_invalid_shape",
                eventName: ANALYTICS_EVENTS.SHOWROOM_VIEW,
            },
        });
    });
});
