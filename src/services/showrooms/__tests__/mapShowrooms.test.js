import { jest } from "@jest/globals";

const DEV_STORE = { showrooms: [] };

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(),
}));

jest.unstable_mockModule("../_store.js", () => ({
    DEV_STORE,
    useDevMock: true,
}));

const { mapShowroomsService } = await import("../mapShowrooms.js");

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

describe("showrooms map endpoint service", () => {
    beforeEach(() => {
        DEV_STORE.showrooms = [
            showroom("sr-1", 52.2297, 21.0122),
            showroom("sr-2", 52.2397, 21.0222),
            showroom("sr-3", 52.2497, 21.0322),
        ];
    });

    it("returns viewport showrooms on low zoom", async () => {
        const result = await mapShowroomsService({
            north: "53",
            south: "52",
            east: "22",
            west: "21",
            zoom: "4",
        });

        expect(result.showrooms.length).toBe(3);
        expect(result.meta.truncated).toBe(false);
    });

    it("returns viewport showrooms on high zoom", async () => {
        const result = await mapShowroomsService({
            north: "52.30",
            south: "52.20",
            east: "21.10",
            west: "21.00",
            zoom: "12",
        });

        expect(result.showrooms.map(item => item.id)).toEqual(["sr-1", "sr-2", "sr-3"]);
        expect(result.meta.truncated).toBe(false);
    });

    it("filters out points outside viewport", async () => {
        const result = await mapShowroomsService({
            north: "52.235",
            south: "52.225",
            east: "21.02",
            west: "21.00",
            zoom: "14",
        });

        expect(result.showrooms.map(item => item.id)).toEqual(["sr-1"]);
    });

    it("rejects invalid bounds", async () => {
        await expect(
            mapShowroomsService({
                north: "52",
                south: "53",
                east: "22",
                west: "21",
                zoom: "4",
            })
        ).rejects.toMatchObject({ code: "QUERY_INVALID" });
    });
});
