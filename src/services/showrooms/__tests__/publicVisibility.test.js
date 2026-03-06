import { jest } from "@jest/globals";

const DEV_STORE = { showrooms: [] };

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(),
}));

jest.unstable_mockModule("../_store.js", () => ({
    DEV_STORE,
    useDevMock: true,
}));

const { getShowroomByIdService } = await import("../getShowroomById.js");

function seedShowroom(overrides = {}) {
    DEV_STORE.showrooms = [
        {
            id: "sr-1",
            ownerUid: "owner-1",
            status: "approved",
            country: "Ukraine",
            name: "Test Showroom",
            ...overrides,
        },
    ];
}

describe("showrooms public visibility", () => {
    beforeEach(() => {
        seedShowroom();
    });

    it("hides blocked-country showroom from public detail", async () => {
        seedShowroom({ country: "Russia" });

        await expect(getShowroomByIdService("sr-1", null)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_FOUND",
        });
    });

    it("still allows admin to open blocked-country showroom", async () => {
        seedShowroom({ country: "Russia" });

        const showroom = await getShowroomByIdService("sr-1", {
            uid: "admin-1",
            role: "admin",
        });

        expect(showroom.id).toBe("sr-1");
    });
});
