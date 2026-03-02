import { jest } from "@jest/globals";

const okMock = jest.fn();
const getShowroomsAnalyticsServiceMock = jest.fn();
const getEventsAnalyticsServiceMock = jest.fn();
const getPlatformAnalyticsServiceMock = jest.fn();
const getUsersOnboardingAnalyticsServiceMock = jest.fn();

jest.unstable_mockModule("../../utils/apiResponse.js", () => ({
    ok: okMock,
}));

jest.unstable_mockModule("../../services/admin/adminAnalyticsService.js", () => ({
    getShowroomsAnalyticsService: getShowroomsAnalyticsServiceMock,
    getEventsAnalyticsService: getEventsAnalyticsServiceMock,
    getPlatformAnalyticsService: getPlatformAnalyticsServiceMock,
    getUsersOnboardingAnalyticsService: getUsersOnboardingAnalyticsServiceMock,
}));

const {
    getShowroomsAnalytics,
    getEventsAnalytics,
    getPlatformAnalytics,
    getUsersOnboardingAnalytics,
} = await import("../adminAnalyticsController.js");

describe("adminAnalyticsController", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("getShowroomsAnalytics returns ok envelope with service data", async () => {
        const data = { created: { total: 1, series: [] }, moderation: { approveCount: 0, rejectCount: 0 } };
        getShowroomsAnalyticsServiceMock.mockResolvedValue(data);
        const req = { query: { groupBy: "day" } };
        const res = {};
        const next = jest.fn();

        await getShowroomsAnalytics(req, res, next);

        expect(getShowroomsAnalyticsServiceMock).toHaveBeenCalledWith(req.query);
        expect(okMock).toHaveBeenCalledWith(res, data);
        expect(next).not.toHaveBeenCalled();
    });

    it("getEventsAnalytics forwards service errors to next", async () => {
        const err = new Error("boom");
        getEventsAnalyticsServiceMock.mockRejectedValue(err);
        const next = jest.fn();

        await getEventsAnalytics({ query: {} }, {}, next);

        expect(next).toHaveBeenCalledWith(err);
    });

    it("getPlatformAnalytics returns ok envelope with service data", async () => {
        const data = { total: 0, timeline: [], byEventName: [] };
        getPlatformAnalyticsServiceMock.mockResolvedValue(data);
        const res = {};

        await getPlatformAnalytics({ query: {} }, res, jest.fn());

        expect(getPlatformAnalyticsServiceMock).toHaveBeenCalledWith({});
        expect(okMock).toHaveBeenCalledWith(res, data);
    });

    it("getUsersOnboardingAnalytics returns ok envelope with service data", async () => {
        const data = {
            funnel: {
                totalUsers: 10,
                onboardingCompleted: 6,
                onboardingNotCompleted: 4,
                ownerProfileCompleted: 2,
                ownerProfileNotCompleted: 4,
            },
        };
        getUsersOnboardingAnalyticsServiceMock.mockResolvedValue(data);
        const req = { query: { includeUsers: "true", limit: "20" } };
        const res = {};

        await getUsersOnboardingAnalytics(req, res, jest.fn());

        expect(getUsersOnboardingAnalyticsServiceMock).toHaveBeenCalledWith(req.query);
        expect(okMock).toHaveBeenCalledWith(res, data);
    });
});
