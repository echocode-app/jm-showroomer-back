import { jest } from "@jest/globals";

const okMock = jest.fn();
const failMock = jest.fn();
const updateUserProfileDocMock = jest.fn();
const ownerHasActiveShowroomsMock = jest.fn();
const ownerHasLookbooksMock = jest.fn();
const ownerHasEventsMock = jest.fn();
const normalizeInstagramUrlMock = jest.fn(value => value);
const validateInstagramUrlMock = jest.fn();
const normalizeAppLanguageMock = jest.fn(value => value);

jest.unstable_mockModule("../../utils/apiResponse.js", () => ({
    ok: okMock,
    fail: failMock,
}));

jest.unstable_mockModule("../../utils/showroomValidation.js", () => ({
    normalizeInstagramUrl: normalizeInstagramUrlMock,
    validateInstagramUrl: validateInstagramUrlMock,
}));

jest.unstable_mockModule("../../services/users/profileService.js", () => ({
    updateUserOnboarding: jest.fn(),
    updateOwnerProfile: jest.fn(),
    updateUserProfileDoc: updateUserProfileDocMock,
    ownerHasActiveShowrooms: ownerHasActiveShowroomsMock,
    ownerHasLookbooks: ownerHasLookbooksMock,
    ownerHasEvents: ownerHasEventsMock,
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

const { updateUserProfile } = await import("../users/profileController.js");

describe("user profile controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ownerHasActiveShowroomsMock.mockResolvedValue(false);
        ownerHasLookbooksMock.mockResolvedValue(false);
        ownerHasEventsMock.mockResolvedValue(false);
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
                position: "Founder",
                instagram: "https://instagram.com/victoria",
            },
            user: { uid: "owner-1", role: "owner", country: "Ukraine" },
            auth: { uid: "owner-1" },
        };
        const res = {};

        await updateUserProfile(req, res, undefined);

        expect(validateInstagramUrlMock).toHaveBeenCalled();
        expect(updateUserProfileDocMock).toHaveBeenCalledWith(
            "owner-1",
            expect.objectContaining({
                name: "Victoria",
                "ownerProfile.name": "Victoria",
                "ownerProfile.position": "Founder",
                "ownerProfile.instagram": "https://instagram.com/victoria",
            })
        );
        expect(okMock).toHaveBeenCalledWith(res, { message: "Profile updated" });
    });
});
