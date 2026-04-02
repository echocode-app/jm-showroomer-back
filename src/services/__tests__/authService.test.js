import { jest } from "@jest/globals";

const verifyIdTokenMock = jest.fn();
const getMock = jest.fn();
const setMock = jest.fn();

jest.unstable_mockModule("../../config/firebase.js", () => ({
    getAuthInstance: jest.fn(() => ({
        verifyIdToken: verifyIdTokenMock,
    })),
    getFirestoreInstance: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: getMock,
                set: setMock,
            })),
        })),
    })),
}));

const { verifyOAuthToken } = await import("../authService.js");

describe("authService.verifyOAuthToken", () => {
    beforeEach(() => {
        verifyIdTokenMock.mockReset();
        getMock.mockReset();
        setMock.mockReset();
    });

    it("creates a new baseline user profile on first login", async () => {
        verifyIdTokenMock.mockResolvedValue({
            uid: "u1",
            email: "user@example.com",
            name: "User One",
            picture: "https://avatar.test/u1.png",
            firebase: { sign_in_provider: "google.com" },
        });
        getMock.mockResolvedValue({
            exists: false,
            data: () => undefined,
        });

        const result = await verifyOAuthToken("token");

        expect(setMock).toHaveBeenCalledTimes(1);
        expect(setMock.mock.calls[0][0]).toMatchObject({
            uid: "u1",
            role: "user",
            roles: ["user"],
            onboardingState: "new",
            isDeleted: false,
        });
        expect(result.user).toMatchObject({
            uid: "u1",
            role: "user",
            roles: ["user"],
            onboardingState: "new",
            country: null,
        });
    });

    it("reactivates a soft-deleted user without restoring owner role", async () => {
        verifyIdTokenMock.mockResolvedValue({
            uid: "u2",
            email: "restored@example.com",
            name: "Restored User",
            picture: "https://avatar.test/u2.png",
            firebase: { sign_in_provider: "google.com" },
        });
        getMock.mockResolvedValue({
            exists: true,
            data: () => ({
                uid: "u2",
                role: "owner",
                roles: ["owner"],
                onboardingState: "completed",
                country: "Ukraine",
                appLanguage: "uk",
                isDeleted: true,
                deletedAt: "2026-04-02T08:24:58.808Z",
                createdAt: "2026-03-17T00:24:51.881Z",
                ownerProfile: {
                    name: null,
                    position: null,
                    phone: null,
                    instagram: null,
                },
            }),
        });

        const result = await verifyOAuthToken("token");

        expect(setMock).toHaveBeenCalledTimes(1);
        expect(setMock).toHaveBeenCalledWith(
            expect.objectContaining({
                uid: "u2",
                email: "restored@example.com",
                name: "Restored User",
                role: "user",
                roles: ["user"],
                onboardingState: "completed",
                country: "Ukraine",
                appLanguage: "uk",
                isDeleted: false,
                deletedAt: null,
                deleteLock: null,
                deleteLockAt: null,
                ownerProfile: {
                    name: null,
                    position: null,
                    phone: null,
                    instagram: null,
                },
            }),
            { merge: true }
        );
        expect(result.user).toMatchObject({
            uid: "u2",
            role: "user",
            roles: ["user"],
            onboardingState: "completed",
            country: "Ukraine",
            isDeleted: false,
        });
    });
});
