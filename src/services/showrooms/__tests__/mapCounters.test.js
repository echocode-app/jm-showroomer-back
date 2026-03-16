import { jest } from "@jest/globals";

const DEV_STORE = { showrooms: [] };

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(),
}));

jest.unstable_mockModule("../_store.js", () => ({
    DEV_STORE,
    useDevMock: true,
}));

const { mapShowroomCountersService } = await import("../mapCounters.js");

function showroom(id, lat, lng, extra = {}) {
    return {
        id,
        ownerUid: "owner-1",
        status: "approved",
        country: "Poland",
        name: `Showroom ${id}`,
        type: "multibrand",
        category: "womenswear",
        address: `Address ${id}`,
        city: "Warszawa",
        geo: {
            city: "Warszawa",
            cityNormalized: "warszawa",
            country: "Poland",
            geohash: "u3qcnh",
            coords: { lat, lng },
        },
        ...extra,
    };
}

describe("showrooms map counters service", () => {
    beforeEach(() => {
        DEV_STORE.showrooms = [
            showroom("sr-1", 52.2297, 21.0122),
            showroom("sr-2", 52.2397, 21.0222),
            showroom("sr-3", 52.2497, 21.0322),
            showroom("sr-4", 50.4501, 30.5234, {
                country: "Ukraine",
                city: "Kyiv",
                geo: {
                    city: "Kyiv",
                    cityNormalized: "kyiv",
                    country: "Ukraine",
                    geohash: "u8vhvp",
                    coords: { lat: 50.4501, lng: 30.5234 },
                },
            }),
        ];
    });

    it("returns exact viewport total", async () => {
        const result = await mapShowroomCountersService({
            north: "52.30",
            south: "52.20",
            east: "21.10",
            west: "21.00",
            zoom: "12",
        });

        expect(result.total).toBe(3);
        expect(result.meta.exact).toBe(true);
    });

    it("applies viewport filters", async () => {
        const result = await mapShowroomCountersService({
            north: "52.235",
            south: "52.225",
            east: "21.02",
            west: "21.00",
            zoom: "14",
        });

        expect(result.total).toBe(1);
    });

    it("applies optional country filter", async () => {
        const result = await mapShowroomCountersService({
            north: "55",
            south: "49",
            east: "32",
            west: "20",
            zoom: "6",
            country: "Ukraine",
        });

        expect(result.total).toBe(1);
    });
});
