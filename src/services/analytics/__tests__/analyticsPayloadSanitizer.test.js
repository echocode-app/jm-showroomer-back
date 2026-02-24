import {
    applyAnalyticsEventPayloadBudget,
    sanitizeAnalyticsClientObject,
} from "../analyticsPayloadSanitizer.js";

describe("analyticsPayloadSanitizer", () => {
    it("removes blocked keys and caps arrays", () => {
        const input = {
            email: "user@example.com",
            nested: {
                token: "secret",
                values: Array.from({ length: 30 }, (_, i) => i),
            },
        };

        expect(sanitizeAnalyticsClientObject(input)).toEqual({
            nested: {
                values: Array.from({ length: 20 }, (_, i) => i),
            },
        });
    });

    it("caps nested depth", () => {
        expect(
            sanitizeAnalyticsClientObject({
                a: {
                    b: {
                        c: {
                            d: true,
                        },
                    },
                },
            })
        ).toEqual({
            a: {
                b: {
                    c: {
                        truncated: true,
                    },
                },
            },
        });
    });

    it("falls back to truncated payload objects when payload budget is exceeded", () => {
        const huge = "x".repeat(6000);
        const result = applyAnalyticsEventPayloadBudget({
            context: { surface: "s", huge },
            meta: { huge },
            resourceAttributes: { huge },
        });

        expect(result).toEqual({
            context: { truncated: true },
            meta: { truncated: true },
            resourceAttributes: { truncated: true },
        });
    });
});
