import { jest } from "@jest/globals";

const docMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: docMock,
        })),
    })),
    getStorageInstance: jest.fn(() => ({
        bucket: jest.fn(),
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
    getLookbookSharePayloadService,
    resolveLookbookShareRedirectService,
} = await import("../shareLookbook.js");

function seedLookbook(overrides = {}) {
    docMock.mockReturnValue({
        get: jest.fn().mockResolvedValue({
            exists: true,
            id: "lb-share-1",
            data: () => ({
                title: "Spring Capsule",
                name: "Spring Capsule",
                published: true,
                country: "Ukraine",
                ...overrides,
            }),
        }),
    });
}

describe("lookbook share service", () => {
    beforeEach(() => {
        seedLookbook();
    });

    it("builds share payload with detected ios platform", async () => {
        const share = await getLookbookSharePayloadService("lb-share-1", {
            platform: "auto",
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        });

        expect(share.platform).toBe("ios");
        expect(share.shareUrl).toBe("https://api.example.com/api/v1/share/lookbooks/lb-share-1");
        expect(share.deepLinkUrl).toBe("jmshowroomer://lookbooks/lb-share-1");
        expect(share.targets.ios).toContain("apps.apple.com");
        expect(share.recommendedText).toContain("Spring Capsule");
    });

    it("resolves android redirect target", async () => {
        const result = await resolveLookbookShareRedirectService("lb-share-1", {
            platform: "android",
        });

        expect(result.httpStatus).toBe(302);
        expect(result.redirectUrl).toContain("play.google.com");
    });

    it("throws LOOKBOOK_NOT_FOUND when lookbook is not published", async () => {
        seedLookbook({ published: false });

        await expect(
            getLookbookSharePayloadService("lb-share-1", { platform: "ios" })
        ).rejects.toMatchObject({ code: "LOOKBOOK_NOT_FOUND" });
    });

    it("throws LOOKBOOK_NOT_FOUND when lookbook country is blocked", async () => {
        seedLookbook({ country: "Russia" });

        await expect(
            getLookbookSharePayloadService("lb-share-1", { platform: "ios" })
        ).rejects.toMatchObject({ code: "LOOKBOOK_NOT_FOUND" });
    });

    it("throws QUERY_INVALID for unknown platform", async () => {
        await expect(
            getLookbookSharePayloadService("lb-share-1", { platform: "web" })
        ).rejects.toMatchObject({ code: "QUERY_INVALID" });
    });
});
