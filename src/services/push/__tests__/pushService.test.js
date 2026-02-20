import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();
const getMessagingInstanceMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
    getMessagingInstance: getMessagingInstanceMock,
}));

const { sendPushToUser } = await import("../pushService.js");

function buildDb({ userData = {}, userExists = true, devices = [] } = {}) {
    const getUser = jest.fn().mockResolvedValue({
        exists: userExists,
        data: () => userData,
    });
    const getDevices = jest.fn().mockResolvedValue({
        docs: devices.map(item => ({
            data: () => item,
        })),
    });

    return {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: getUser,
                collection: jest.fn(() => ({
                    get: getDevices,
                })),
            })),
        })),
    };
}

describe("sendPushToUser", () => {
    const baseEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...baseEnv, NODE_ENV: "dev" };
        getFirestoreInstanceMock.mockReset();
        getMessagingInstanceMock.mockReset();
    });

    afterAll(() => {
        process.env = baseEnv;
    });

    it("skips when PUSH_ENABLED is not true", async () => {
        process.env.PUSH_ENABLED = "false";

        const result = await sendPushToUser("uid-1", {
            notification: { title: "t", body: "b" },
            data: { type: "T", resourceType: "showroom", resourceId: "1", notificationId: "n1" },
        });

        expect(result.skipped).toBe(true);
        expect(getFirestoreInstanceMock).not.toHaveBeenCalled();
    });

    it("skips when user notifications are disabled", async () => {
        process.env.PUSH_ENABLED = "true";
        const db = buildDb({
            userData: { notificationsEnabled: false },
            devices: [{ fcmToken: "token-a", notificationsEnabled: true }],
        });
        getFirestoreInstanceMock.mockReturnValue(db);

        const messaging = { sendEachForMulticast: jest.fn() };
        getMessagingInstanceMock.mockReturnValue(messaging);

        const result = await sendPushToUser("uid-2", {
            notification: { title: "t", body: "b" },
            data: { type: "T", resourceType: "showroom", resourceId: "1", notificationId: "n1" },
        });

        expect(result.skipped).toBe(true);
        expect(result.reason).toBe("user_notifications_disabled");
        expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
    });

    it("sends push when enabled and user/devices allow it", async () => {
        process.env.PUSH_ENABLED = "true";
        const db = buildDb({
            userData: { notificationsEnabled: true },
            devices: [
                { fcmToken: "token-a", notificationsEnabled: true },
                { fcmToken: "token-b", notificationsEnabled: false },
                { fcmToken: "   ", notificationsEnabled: true },
            ],
        });
        getFirestoreInstanceMock.mockReturnValue(db);

        const sendEachForMulticast = jest.fn().mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }],
        });
        getMessagingInstanceMock.mockReturnValue({ sendEachForMulticast });

        const result = await sendPushToUser("uid-3", {
            notification: { title: "title", body: "body" },
            data: {
                type: "LOOKBOOK_FAVORITED",
                resourceType: "lookbook",
                resourceId: "lb-1",
                notificationId: "notif-1",
            },
        });

        expect(result.skipped).toBe(false);
        expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
        expect(sendEachForMulticast).toHaveBeenCalledWith({
            tokens: ["token-a"],
            notification: { title: "title", body: "body" },
            data: {
                type: "LOOKBOOK_FAVORITED",
                resourceType: "lookbook",
                resourceId: "lb-1",
                notificationId: "notif-1",
            },
        });
    });
});
