import { jest } from "@jest/globals";

const okMock = jest.fn();
const failMock = jest.fn();
const verifyOAuthTokenMock = jest.fn();
const recordMock = jest.fn();
const buildAnalyticsEventMock = jest.fn(() => ({ event: "analytics" }));
const logDomainEventMock = Object.assign(jest.fn(), {
    info: jest.fn(),
});

jest.unstable_mockModule("../../services/authService.js", () => ({
    verifyOAuthToken: verifyOAuthTokenMock,
}));

jest.unstable_mockModule("../../utils/apiResponse.js", () => ({
    ok: okMock,
    fail: failMock,
}));

jest.unstable_mockModule("../../config/logger.js", () => ({
    log: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

jest.unstable_mockModule("../../services/analytics/analyticsEventBuilder.js", () => ({
    buildAnalyticsEvent: buildAnalyticsEventMock,
}));

jest.unstable_mockModule("../../services/analytics/analyticsEventService.js", () => ({
    record: recordMock,
}));

jest.unstable_mockModule("../../services/analytics/eventNames.js", () => ({
    ANALYTICS_EVENTS: {
        AUTH_COMPLETED: "auth_completed",
        AUTH_FAILED: "auth_failed",
    },
}));

jest.unstable_mockModule("../../utils/logDomainEvent.js", () => ({
    logDomainEvent: logDomainEventMock,
}));

jest.unstable_mockModule("../../utils/errorClassifier.js", () => ({
    classifyError: jest.fn(() => ({
        level: "warn",
        category: "domain_validation",
    })),
}));

const { oauthLogin } = await import("../authController.js");

describe("authController.oauthLogin", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("does not crash on missing body and returns structured auth error", async () => {
        const err = new Error("Missing idToken");
        err.code = "ID_TOKEN_REQUIRED";
        err.status = 400;
        verifyOAuthTokenMock.mockRejectedValue(err);

        const req = {};
        const res = {};
        const next = jest.fn();

        await oauthLogin(req, res, next);

        expect(verifyOAuthTokenMock).toHaveBeenCalledWith(undefined);
        expect(failMock).toHaveBeenCalledWith(res, "ID_TOKEN_REQUIRED", "Missing idToken", 400);
        expect(next).not.toHaveBeenCalled();
    });

    it("returns ok envelope on successful login", async () => {
        verifyOAuthTokenMock.mockResolvedValue({
            user: { uid: "user-1" },
            signInProvider: "google.com",
        });

        const req = {
            body: {
                idToken: "token",
            },
        };
        const res = {};
        const next = jest.fn();

        await oauthLogin(req, res, next);

        expect(verifyOAuthTokenMock).toHaveBeenCalledWith("token");
        expect(okMock).toHaveBeenCalledWith(res, { user: { uid: "user-1" } });
        expect(next).not.toHaveBeenCalled();
    });
});
