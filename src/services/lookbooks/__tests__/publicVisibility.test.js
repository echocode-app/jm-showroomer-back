import { jest } from "@jest/globals";

const getMock = jest.fn();

jest.unstable_mockModule("../firestoreQuery.js", () => ({
    getLookbooksCollection: jest.fn(() => ({
        doc: jest.fn(() => ({
            get: getMock,
        })),
    })),
}));

jest.unstable_mockModule("../response.js", () => ({
    normalizeLookbook: jest.fn(doc => doc),
}));

const { getLookbookByIdService } = await import("../getLookbookById.js");

describe("lookbooks public visibility", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("hides blocked-country lookbook from public detail", async () => {
        getMock.mockResolvedValue({
            exists: true,
            id: "lb-1",
            data: () => ({
                published: true,
                country: "Russia",
            }),
        });

        await expect(getLookbookByIdService("lb-1")).rejects.toMatchObject({
            code: "LOOKBOOK_NOT_FOUND",
        });
    });
});
