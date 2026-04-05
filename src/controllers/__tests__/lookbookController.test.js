import { jest } from "@jest/globals";

const failMock = jest.fn();

jest.unstable_mockModule("../../utils/apiResponse.js", () => ({
    created: jest.fn(),
    fail: failMock,
    ok: jest.fn(),
}));

jest.unstable_mockModule("../../services/lookbooksService.js", () => ({
    createLookbookService: jest.fn(),
    deleteLookbookService: jest.fn(),
    getLookbookByIdCrudService: jest.fn(),
    getLookbookSharePayloadService: jest.fn(),
    listLookbooksService: jest.fn(),
    likeLookbookService: jest.fn(),
    listLookbooksCrudService: jest.fn(),
    resolveLookbookShareRedirectService: jest.fn(),
    unlikeLookbookService: jest.fn(),
    updateLookbookService: jest.fn(),
}));

jest.unstable_mockModule("../../services/lookbooks/response.js", () => ({
    attachCoverUrl: jest.fn(),
    attachSignedImages: jest.fn(),
}));

jest.unstable_mockModule("../../utils/actorIdentity.js", () => ({
    attachAnonymousIdHeader: jest.fn(),
    resolveActorIdentity: jest.fn(),
}));

jest.unstable_mockModule("../../services/analytics/viewThrottleService.js", () => ({
    shouldEmitView: jest.fn(() => false),
}));

jest.unstable_mockModule("../../services/analytics/analyticsEventBuilder.js", () => ({
    buildAnalyticsEvent: jest.fn(),
}));

jest.unstable_mockModule("../../services/analytics/analyticsEventService.js", () => ({
    record: jest.fn(),
}));

jest.unstable_mockModule("../../services/analytics/eventNames.js", () => ({
    ANALYTICS_EVENTS: {},
}));

jest.unstable_mockModule("../../config/logger.js", () => ({
    log: {},
}));

jest.unstable_mockModule("../../utils/logDomainEvent.js", () => ({
    logDomainEvent: {
        info: jest.fn(),
    },
}));

jest.unstable_mockModule("../../utils/favoriteToggleLogGuard.js", () => ({
    shouldEmitFavoriteToggleLog: jest.fn(() => false),
}));

const { rsvpLookbook } = await import("../lookbookController.js");

describe("lookbookController.rsvpLookbook", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns MVP2-only 501 instead of false success stub", async () => {
        const req = {
            params: { id: "lb-1" },
            auth: { uid: "user-1" },
        };
        const res = {};
        const next = jest.fn();

        await rsvpLookbook(req, res, next);

        expect(failMock).toHaveBeenCalledWith(
            res,
            "LOOKBOOKS_WRITE_MVP2_ONLY",
            "Lookbook RSVP endpoint is MVP2 only",
            501
        );
        expect(next).not.toHaveBeenCalled();
    });
});
