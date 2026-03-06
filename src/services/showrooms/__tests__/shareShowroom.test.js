import { jest } from "@jest/globals";

const DEV_STORE = { showrooms: [] };

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(),
}));

jest.unstable_mockModule("../../../config/index.js", () => ({
    CONFIG: {
        shareApiBaseUrl: "https://api.example.com/api/v1",
        shareIosStoreUrl: "https://apps.apple.com/app/id123456",
        shareAndroidStoreUrl: "https://play.google.com/store/apps/details?id=com.jm.showroomer",
        shareDeepLinkScheme: "jmshowroomer://",
    },
}));

jest.unstable_mockModule("../_store.js", () => ({
    DEV_STORE,
    useDevMock: true,
}));

const {
    getShowroomSharePayloadService,
    resolveShowroomShareRedirectService,
} = await import("../shareShowroom.js");

function seedShowroom(overrides = {}) {
    DEV_STORE.showrooms = [
        {
            id: "sr-share-1",
            status: "approved",
            name: "Kyiv Loft",
            ...overrides,
        },
    ];
}

describe("showroom share service", () => {
    beforeEach(() => {
        seedShowroom();
    });

    it("builds share payload with detected ios platform", async () => {
        const share = await getShowroomSharePayloadService("sr-share-1", {
            platform: "auto",
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        });

        expect(share.platform).toBe("ios");
        expect(share.shareUrl).toBe("https://api.example.com/api/v1/share/showrooms/sr-share-1");
        expect(share.deepLinkUrl).toBe("jmshowroomer://showrooms/sr-share-1");
        expect(share.targets.ios).toContain("apps.apple.com");
        expect(share.recommendedText).toContain("Kyiv Loft");
    });

    it("resolves android redirect target", async () => {
        const result = await resolveShowroomShareRedirectService("sr-share-1", {
            platform: "android",
        });

        expect(result.httpStatus).toBe(302);
        expect(result.redirectUrl).toContain("play.google.com");
    });

    it("throws SHOWROOM_NOT_FOUND when showroom is not approved", async () => {
        seedShowroom({ status: "pending" });

        await expect(
            getShowroomSharePayloadService("sr-share-1", { platform: "ios" })
        ).rejects.toMatchObject({ code: "SHOWROOM_NOT_FOUND" });
    });

    it("throws SHOWROOM_NOT_FOUND when showroom country is blocked", async () => {
        seedShowroom({ country: "Russia" });

        await expect(
            getShowroomSharePayloadService("sr-share-1", { platform: "ios" })
        ).rejects.toMatchObject({ code: "SHOWROOM_NOT_FOUND" });
    });

    it("throws QUERY_INVALID for unknown platform", async () => {
        await expect(
            getShowroomSharePayloadService("sr-share-1", { platform: "web" })
        ).rejects.toMatchObject({ code: "QUERY_INVALID" });
    });
});
