import { jest } from "@jest/globals";

const verifyIdTokenMock = jest.fn();
const attachActorLogContextMock = jest.fn();
const failMock = jest.fn((res, code, message, status) => {
    res.statusCode = status;
    res.payload = { code, message };
    return res;
});

const CONFIG = {
    allowGuestLookbookWrites: true,
};

jest.unstable_mockModule("../../config/firebase.js", () => ({
    getAuthInstance: jest.fn(() => ({
        verifyIdToken: verifyIdTokenMock,
    })),
}));

jest.unstable_mockModule("../../config/index.js", () => ({
    CONFIG,
}));

jest.unstable_mockModule("../requestLogContext.js", () => ({
    attachActorLogContext: attachActorLogContextMock,
}));

jest.unstable_mockModule("../../utils/apiResponse.js", () => ({
    fail: failMock,
}));

const { optionalAuth } = await import("../optionalAuth.js");
const { requireLookbookWriteIdentity } = await import("../guestWritePolicy.js");

describe("lookbook guest write auth semantics", () => {
    beforeEach(() => {
        verifyIdTokenMock.mockReset();
        attachActorLogContextMock.mockReset();
        failMock.mockClear();
        CONFIG.allowGuestLookbookWrites = true;
    });

    it("allows guest write when bearer token is absent and guest writes are enabled", async () => {
        const req = { headers: {} };
        const res = {};
        const next = jest.fn();

        await optionalAuth(req, res, next);
        requireLookbookWriteIdentity(req, res, next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(req.optionalAuthInvalid).toBeUndefined();
        expect(failMock).not.toHaveBeenCalled();
    });

    it("rejects invalid bearer token even when guest writes are enabled", async () => {
        verifyIdTokenMock.mockRejectedValue(new Error("bad token"));

        const req = {
            headers: {
                authorization: "Bearer invalid",
            },
        };
        const res = {};
        const next = jest.fn();

        await optionalAuth(req, res, next);
        requireLookbookWriteIdentity(req, res, next);

        expect(req.optionalAuthInvalid).toBe(true);
        expect(next).toHaveBeenCalledTimes(1);
        expect(failMock).toHaveBeenCalledWith(res, "AUTH_INVALID", "Invalid or expired token", 401);
    });

    it("rejects invalid bearer token when guest writes are disabled", async () => {
        verifyIdTokenMock.mockRejectedValue(new Error("bad token"));
        CONFIG.allowGuestLookbookWrites = false;

        const req = {
            headers: {
                authorization: "Bearer invalid",
            },
        };
        const res = {};
        const next = jest.fn();

        await optionalAuth(req, res, next);
        requireLookbookWriteIdentity(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(failMock).toHaveBeenCalledWith(res, "AUTH_INVALID", "Invalid or expired token", 401);
    });

    it("requires auth when bearer token is absent and guest writes are disabled", async () => {
        CONFIG.allowGuestLookbookWrites = false;

        const req = { headers: {} };
        const res = {};
        const next = jest.fn();

        await optionalAuth(req, res, next);
        requireLookbookWriteIdentity(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(failMock).toHaveBeenCalledWith(res, "AUTH_MISSING", "Authorization token missing", 401);
    });

    it("passes authenticated write through when bearer token is valid", async () => {
        verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
        CONFIG.allowGuestLookbookWrites = false;

        const req = {
            headers: {
                authorization: "Bearer valid",
            },
        };
        const res = {};
        const next = jest.fn();

        await optionalAuth(req, res, next);
        requireLookbookWriteIdentity(req, res, next);

        expect(req.auth).toEqual({ uid: "user-1" });
        expect(req.optionalAuthInvalid).toBeUndefined();
        expect(attachActorLogContextMock).toHaveBeenCalledWith(req);
        expect(next).toHaveBeenCalledTimes(2);
        expect(failMock).not.toHaveBeenCalled();
    });
});
