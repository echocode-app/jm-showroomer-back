import { jest } from "@jest/globals";

const createNotificationMock = jest.fn(async () => ({ created: true, pushed: false }));
const DEV_STORE = { showrooms: [] };

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(),
}));

jest.unstable_mockModule("../../../config/logger.js", () => ({
    log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.unstable_mockModule("../../notifications/notificationService.js", () => ({
    createNotification: createNotificationMock,
}));

jest.unstable_mockModule("../_store.js", () => ({
    DEV_STORE,
    useDevMock: true,
}));

const { deleteShowroomService } = await import("../deleteShowroom.js");

function makeShowroom(overrides = {}) {
    return {
        id: "sr-1",
        ownerUid: "owner-1",
        status: "approved",
        name: "Showroom A",
        editHistory: [],
        ...overrides,
    };
}

describe("deleteShowroomService notifications", () => {
    beforeEach(() => {
        DEV_STORE.showrooms = [makeShowroom()];
        createNotificationMock.mockClear();
    });

    it("sends owner notification when admin deletes showroom", async () => {
        const admin = { uid: "admin-1", role: "admin" };
        await deleteShowroomService("sr-1", admin);

        expect(createNotificationMock).toHaveBeenCalledTimes(1);
        expect(createNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                targetUid: "owner-1",
                actorUid: "admin-1",
                type: "SHOWROOM_DELETED_BY_ADMIN",
                resourceType: "showroom",
                resourceId: "sr-1",
                dedupeKey: "showroom:sr-1:deleted_by_admin",
            })
        );
    });

    it("does not send notification when owner deletes own showroom", async () => {
        const owner = { uid: "owner-1", role: "owner" };
        await deleteShowroomService("sr-1", owner);

        expect(createNotificationMock).not.toHaveBeenCalled();
    });
});
