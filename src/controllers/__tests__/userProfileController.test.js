import { jest } from "@jest/globals";

const okMock = jest.fn();
const failMock = jest.fn();
const updateUserProfileDocMock = jest.fn();
const ownerHasActiveShowroomsMock = jest.fn();
const normalizeInstagramUrlMock = jest.fn(value => value);
const validateInstagramUrlMock = jest.fn();
const validatePhoneMock = jest.fn(value => ({ e164: value }));
const normalizeAppLanguageMock = jest.fn(value => value);

jest.unstable_mockModule("../../utils/apiResponse.js", () => ({
    ok: okMock,
    fail: failMock,
}));

jest.unstable_mockModule("../../utils/showroomValidation.js", () => ({
    normalizeInstagramUrl: normalizeInstagramUrlMock,
    validateInstagramUrl: validateInstagramUrlMock,
    validatePhone: validatePhoneMock,
}));

jest.unstable_mockModule("../../services/users/profileService.js", () => ({
    updateUserOnboarding: jest.fn(),
    updateOwnerProfile: jest.fn(),
    updateUserProfileDoc: updateUserProfileDocMock,
    ownerHasActiveShowrooms: ownerHasActiveShowroomsMock,
    ownerHasLookbooks: jest.fn(),
    ownerHasEvents: jest.fn(),
}));

jest.unstable_mockModule("../../services/analytics/eventNames.js", () => ({
    ANALYTICS_EVENTS: {},
}));

jest.unstable_mockModule("../../services/analytics/analyticsEventBuilder.js", () => ({
    buildAnalyticsEvent: jest.fn(),
}));

jest.unstable_mockModule("../../services/analytics/analyticsEventService.js", () => ({
    record: jest.fn(),
}));

jest.unstable_mockModule("../../config/logger.js", () => ({
    log: { error: jest.fn() },
}));

jest.unstable_mockModule("../../constants/appLanguage.js", () => ({
    normalizeAppLanguage: normalizeAppLanguageMock,
}));

const { getMyProfile, updateUserProfile } = await import("../users/profileController.js");

describe("user profile controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ownerHasActiveShowroomsMock.mockResolvedValue(false);
    });

    it("normalizes profile timestamps before returning /users/me", async () => {
        const req = {
            user: {
                uid: "user-1",
                role: "user",
                createdAt: new Date("2026-04-05T10:00:00.000Z"),
                updatedAt: {
                    toDate: () => new Date("2026-04-05T11:00:00.000Z"),
                },
                deletedAt: null,
            },
        };
        const res = {};

        await getMyProfile(req, res);

        expect(okMock).toHaveBeenCalledWith(
            res,
            expect.objectContaining({
                uid: "user-1",
                createdAt: "2026-04-05T10:00:00.000Z",
                updatedAt: "2026-04-05T11:00:00.000Z",
                deletedAt: null,
            })
        );
    });

    it("blocks identity fields before owner profile registration", async () => {
        const req = {
            body: { name: "Victoria" },
            user: { uid: "user-1", role: "user", country: "Ukraine" },
            auth: { uid: "user-1" },
        };

        await updateUserProfile(req, {}, undefined);

        expect(failMock).toHaveBeenCalledWith(
            {},
            "USER_PROFILE_FIELDS_FORBIDDEN",
            "Only language and notification settings can be changed before owner profile registration",
            403
        );
        expect(updateUserProfileDocMock).not.toHaveBeenCalled();
    });

    it("allows pre-owner settings update", async () => {
        const req = {
            body: { appLanguage: "uk", notificationsEnabled: true },
            user: { uid: "user-1", role: "user", country: "Ukraine" },
            auth: { uid: "user-1" },
        };
        const res = {};

        await updateUserProfile(req, res, undefined);

        expect(normalizeAppLanguageMock).toHaveBeenCalledWith("uk");
        expect(updateUserProfileDocMock).toHaveBeenCalledWith(
            "user-1",
            expect.objectContaining({
                appLanguage: "uk",
                notificationsEnabled: true,
            })
        );
        expect(okMock).toHaveBeenCalledWith(res, { message: "Profile updated" });
    });

    it("allows owner identity updates and mirrors name into ownerProfile", async () => {
        const req = {
            body: {
                name: "Victoria",
                phone: "+380501112233",
                position: "Founder",
                instagram: "https://instagram.com/victoria",
            },
            user: { uid: "owner-1", role: "owner", country: "Ukraine" },
            auth: { uid: "owner-1" },
        };
        const res = {};

        await updateUserProfile(req, res, undefined);

        expect(validateInstagramUrlMock).toHaveBeenCalled();
        expect(validatePhoneMock).toHaveBeenCalledWith("+380501112233", "Ukraine");
        expect(updateUserProfileDocMock).toHaveBeenCalledWith(
            "owner-1",
            expect.objectContaining({
                name: "Victoria",
                "ownerProfile.name": "Victoria",
                "ownerProfile.position": "Founder",
                "ownerProfile.phone": "+380501112233",
                "ownerProfile.instagram": "https://instagram.com/victoria",
            })
        );
        expect(okMock).toHaveBeenCalledWith(res, { message: "Profile updated" });
    });

    it("allows owner phone update and stores normalized ownerProfile.phone", async () => {
        const req = {
            body: {
                phone: "+380501112233",
            },
            user: { uid: "owner-1", role: "owner", country: "Ukraine" },
            auth: { uid: "owner-1" },
        };
        const res = {};

        await updateUserProfile(req, res, undefined);

        expect(validatePhoneMock).toHaveBeenCalledWith("+380501112233", "Ukraine");
        expect(updateUserProfileDocMock).toHaveBeenCalledWith(
            "owner-1",
            expect.objectContaining({
                "ownerProfile.phone": "+380501112233",
            })
        );
        expect(okMock).toHaveBeenCalledWith(res, { message: "Profile updated" });
    });

    it("blocks owner country change only when owner has showrooms", async () => {
        ownerHasActiveShowroomsMock.mockResolvedValue(true);
        const req = {
            body: { country: "Poland" },
            user: { uid: "owner-1", role: "owner", country: "Ukraine" },
            auth: { uid: "owner-1" },
        };

        await updateUserProfile(req, {}, undefined);

        expect(failMock).toHaveBeenCalledWith(
            {},
            "USER_COUNTRY_CHANGE_BLOCKED",
            "To change country, delete your showrooms or create a new account",
            409
        );
        expect(updateUserProfileDocMock).not.toHaveBeenCalled();
    });
});
