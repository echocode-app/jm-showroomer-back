import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();
const sendPushToUserMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
}));

jest.unstable_mockModule("../../push/send.js", () => ({
    sendPushToUser: sendPushToUserMock,
}));

const { createNotification } = await import("../create.js");

function buildDb() {
    const docRef = {
        create: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
    };
    const db = {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                collection: jest.fn(() => ({
                    doc: jest.fn(() => docRef),
                })),
            })),
        })),
    };
    return { db, docRef };
}

describe("notification policy gating", () => {
    const baseEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...baseEnv, NODE_ENV: "test", MVP_MODE: "false" };
        getFirestoreInstanceMock.mockReset();
        sendPushToUserMock.mockReset();
    });

    afterAll(() => {
        process.env = baseEnv;
    });

    it("skips LOOKBOOK_FAVORITED when MVP_MODE=true", async () => {
        process.env.MVP_MODE = "true";

        const result = await createNotification({
            targetUid: "owner-1",
            actorUid: "user-1",
            type: "LOOKBOOK_FAVORITED",
            resourceType: "lookbook",
            resourceId: "lb-1",
            payload: { lookbookName: "Lookbook A" },
            dedupeKey: "lookbook:lb-1:favorited:user-1",
        });

        expect(result).toEqual({
            skippedByPolicy: true,
            created: false,
            pushed: false,
        });
        expect(getFirestoreInstanceMock).not.toHaveBeenCalled();
        expect(sendPushToUserMock).not.toHaveBeenCalled();
    });

    it("skips EVENT_WANT_TO_VISIT when MVP_MODE=true", async () => {
        process.env.MVP_MODE = "true";

        const result = await createNotification({
            targetUid: "owner-1",
            actorUid: "user-2",
            type: "EVENT_WANT_TO_VISIT",
            resourceType: "event",
            resourceId: "ev-1",
            payload: { eventName: "Event A" },
            dedupeKey: "event:ev-1:want:user-2",
        });

        expect(result).toEqual({
            skippedByPolicy: true,
            created: false,
            pushed: false,
        });
        expect(getFirestoreInstanceMock).not.toHaveBeenCalled();
        expect(sendPushToUserMock).not.toHaveBeenCalled();
    });

    it("keeps SHOWROOM_APPROVED enabled when MVP_MODE=true", async () => {
        process.env.MVP_MODE = "true";
        const { db, docRef } = buildDb();
        getFirestoreInstanceMock.mockReturnValue(db);
        sendPushToUserMock.mockResolvedValue({ skipped: false, successCount: 1, failureCount: 0 });

        const result = await createNotification({
            targetUid: "owner-2",
            actorUid: "admin-1",
            type: "SHOWROOM_APPROVED",
            resourceType: "showroom",
            resourceId: "sr-1",
            payload: { showroomName: "Showroom A" },
            dedupeKey: "showroom:sr-1:approved",
        });

        expect(result).toEqual({
            skippedByPolicy: false,
            created: true,
            pushed: true,
        });
        expect(docRef.create).toHaveBeenCalledTimes(1);
        expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    });
});
