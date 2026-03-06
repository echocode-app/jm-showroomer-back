import { jest } from "@jest/globals";

const fetchRankedMock = jest.fn();
const fetchUnrankedMock = jest.fn();
const fetchWithInMemoryFallbackMock = jest.fn();
const fetchNearbyMock = jest.fn();
const mapNearbyIndexErrorMock = jest.fn();

jest.unstable_mockModule("../list/queryFetch.js", () => ({
    fetchRanked: fetchRankedMock,
    fetchUnranked: fetchUnrankedMock,
}));

jest.unstable_mockModule("../list/fallback.js", () => ({
    fetchWithInMemoryFallback: fetchWithInMemoryFallbackMock,
}));

jest.unstable_mockModule("../list/nearby.js", () => ({
    fetchNearby: fetchNearbyMock,
    mapNearbyIndexError: mapNearbyIndexErrorMock,
}));

const { listLookbooksService } = await import("../listLookbooks.js");

describe("lookbooks list visibility", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns empty result for blocked-country catalog requests", async () => {
        const result = await listLookbooksService({ country: "Russia", limit: 2 });

        expect(result).toEqual({
            lookbooks: [],
            meta: {
                hasMore: false,
                nextCursor: null,
                paging: "end",
            },
        });
        expect(fetchRankedMock).not.toHaveBeenCalled();
        expect(fetchUnrankedMock).not.toHaveBeenCalled();
        expect(fetchNearbyMock).not.toHaveBeenCalled();
        expect(fetchWithInMemoryFallbackMock).not.toHaveBeenCalled();
    });
});
