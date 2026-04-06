import { buildEventResponse } from "../eventResponse.js";

describe("event response normalization", () => {
    it("adds normalized country key for client-side localization", () => {
        const result = buildEventResponse({
            id: "evt-1",
            name: "Fashion Week",
            country: "Ukraine",
            type: "fashion_week",
            published: true,
            startsAt: "2026-03-20T10:00:00.000Z",
        });

        expect(result.countryNormalized).toBe("ukraine");
        expect(result.type).toBe("fashion_week");
    });

    it("normalizes wantToVisitCount to a safe non-negative integer", () => {
        const result = buildEventResponse({
            id: "evt-2",
            name: "Popup",
            country: "Ukraine",
            published: true,
            startsAt: "2026-03-20T10:00:00.000Z",
            wantToVisitCount: -3.7,
        });

        expect(result.wantToVisitCount).toBe(0);
    });
});
