import { jest } from "@jest/globals";

const docMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: docMock,
        })),
    })),
}));

jest.unstable_mockModule("../../../config/index.js", () => ({
    CONFIG: {
        shareApiBaseUrl: "https://api.example.com/api/v1",
        shareIosStoreUrl: "https://apps.apple.com/app/id123456",
        shareAndroidStoreUrl: "https://play.google.com/store/apps/details?id=com.jm.showroomer",
        shareDeepLinkScheme: "jmshowroomer://",
    },
}));

const {
    getEventSharePayloadService,
    resolveEventShareRedirectService,
} = await import("../shareEvent.js");

function seedEvent(overrides = {}) {
    docMock.mockReturnValue({
        get: jest.fn().mockResolvedValue({
            exists: true,
            id: "ev-share-1",
            data: () => ({
                name: "Fashion Week",
                published: true,
                country: "Ukraine",
                startsAt: "2026-09-10T11:00:00.000Z",
                endsAt: "2026-09-10T13:00:00.000Z",
                ...overrides,
            }),
        }),
    });
}

describe("event share service", () => {
    beforeEach(() => {
        seedEvent();
    });

    it("builds share payload with detected ios platform", async () => {
        const share = await getEventSharePayloadService("ev-share-1", {
            platform: "auto",
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        });

        expect(share.platform).toBe("ios");
        expect(share.shareUrl).toBe("https://api.example.com/api/v1/share/events/ev-share-1");
        expect(share.deepLinkUrl).toBe("jmshowroomer://events/ev-share-1");
        expect(share.targets.ios).toContain("apps.apple.com");
        expect(share.recommendedText).toContain("Fashion Week");
    });

    it("resolves android redirect target", async () => {
        const result = await resolveEventShareRedirectService("ev-share-1", {
            platform: "android",
        });

        expect(result.httpStatus).toBe(302);
        expect(result.redirectUrl).toContain("play.google.com");
    });

    it("throws EVENT_NOT_FOUND when event is not published", async () => {
        seedEvent({ published: false });

        await expect(
            getEventSharePayloadService("ev-share-1", { platform: "ios" })
        ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
    });

    it("throws EVENT_NOT_FOUND when event country is blocked", async () => {
        seedEvent({ country: "Russia" });

        await expect(
            getEventSharePayloadService("ev-share-1", { platform: "ios" })
        ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
    });

    it("throws QUERY_INVALID for unknown platform", async () => {
        await expect(
            getEventSharePayloadService("ev-share-1", { platform: "web" })
        ).rejects.toMatchObject({ code: "QUERY_INVALID" });
    });
});
