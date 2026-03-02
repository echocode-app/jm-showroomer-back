import { parseLookbookListFilters } from "../parse.js";

describe("parseLookbookListFilters", () => {
    it("accepts country-only request and keeps seasonKey optional", () => {
        const parsed = parseLookbookListFilters({ country: "Ukraine" });

        expect(parsed.countryNormalized).toBe("ukraine");
        expect(parsed.seasonKey).toBeNull();
        expect(parsed.nearbyGeohashPrefixes).toEqual([]);
        expect(parsed.limit).toBe(20);
    });

    it("normalizes seasonKey when provided", () => {
        const parsed = parseLookbookListFilters({
            country: "Ukraine",
            seasonKey: " SS-2026 ",
        });

        expect(parsed.seasonKey).toBe("ss-2026");
    });

    it("derives nearby geohash prefixes from near params", () => {
        const parsed = parseLookbookListFilters({
            country: "Ukraine",
            nearLat: "50.4501",
            nearLng: "30.5234",
            nearRadiusKm: "5",
        });

        expect(parsed.nearbyGeohashPrefixes.length).toBeGreaterThan(0);
    });

    it("rejects partial nearby params", () => {
        expect(() => parseLookbookListFilters({
            country: "Ukraine",
            nearLat: "50.4501",
        })).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
    });

    it("rejects missing country", () => {
        expect(() => parseLookbookListFilters({ seasonKey: "ss-2026" }))
            .toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
    });
});
