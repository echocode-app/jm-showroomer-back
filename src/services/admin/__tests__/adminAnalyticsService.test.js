import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
}));

const {
    getShowroomsAnalyticsService,
    getEventsAnalyticsService,
    getPlatformAnalyticsService,
} = await import("../adminAnalyticsService.js");

function stableValue(value) {
    if (value instanceof Date) return `date:${value.toISOString()}`;
    return value;
}

function queryKey(collectionName, filters = []) {
    return JSON.stringify({
        collectionName,
        filters: filters.map(f => ({
            field: f.field,
            op: f.op,
            value: stableValue(f.value),
        })),
    });
}

function makeDoc(data) {
    return {
        data: () => JSON.parse(JSON.stringify(data)),
    };
}

function makeQuery(collectionName, state, filters = []) {
    return {
        where(field, op, value) {
            return makeQuery(collectionName, state, [...filters, { field, op, value }]);
        },
        count() {
            return {
                async get() {
                    const count = state.counts.get(queryKey(collectionName, filters)) ?? 0;
                    return { data: () => ({ count }) };
                },
            };
        },
        async get() {
            const docs = state.docs.get(queryKey(collectionName, filters)) ?? [];
            return { docs: docs.map(makeDoc) };
        },
    };
}

function makeDb(state) {
    return {
        collection(name) {
            return makeQuery(name, state);
        },
    };
}

describe("adminAnalyticsService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("groups showroom creations by day and counts approve/reject from editHistory", async () => {
        const from = "2026-02-01T00:00:00.000Z";
        const to = "2026-02-10T00:00:00.000Z";
        const state = {
            counts: new Map([
                [queryKey("showrooms", [
                    { field: "createdAt", op: ">=", value: new Date(from) },
                    { field: "createdAt", op: "<", value: new Date(to) },
                ]), 3],
            ]),
            docs: new Map([
                [queryKey("showrooms", [
                    { field: "createdAt", op: ">=", value: new Date(from) },
                    { field: "createdAt", op: "<", value: new Date(to) },
                ]), [
                    { createdAt: "2026-02-02T10:00:00.000Z" },
                    { createdAt: "2026-02-02T12:00:00.000Z" },
                    { createdAt: "2026-02-05T09:00:00.000Z" },
                ]],
                [queryKey("showrooms", [
                    { field: "updatedAt", op: ">=", value: new Date(from) },
                ]), [
                    {
                        editHistory: [
                            { action: "approve", at: "2026-02-03T10:00:00.000Z" },
                            { action: "reject", at: "2026-02-04T10:00:00.000Z" },
                            { action: "approve", at: "2026-01-20T10:00:00.000Z" },
                        ],
                    },
                    {
                        editHistory: [
                            { action: "reject", at: "2026-02-06T10:00:00.000Z" },
                            { action: "submit", at: "2026-02-07T10:00:00.000Z" },
                        ],
                    },
                ]],
            ]),
        };

        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        const result = await getShowroomsAnalyticsService({ from, to, groupBy: "day" });

        expect(result.created.total).toBe(3);
        expect(result.created.series).toEqual([
            { bucket: "2026-02-02T00:00:00.000Z", count: 2 },
            { bucket: "2026-02-05T00:00:00.000Z", count: 1 },
        ]);
        expect(result.moderation).toEqual({
            approveCount: 1,
            rejectCount: 2,
        });
    });

    it("returns events analytics with weekly grouping and summary counts", async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-02-26T12:00:00.000Z"));
        const from = "2026-02-01T00:00:00.000Z";
        const to = "2026-03-01T00:00:00.000Z";
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const state = {
            counts: new Map([
                [queryKey("events", [
                    { field: "createdAt", op: ">=", value: new Date(from) },
                    { field: "createdAt", op: "<", value: new Date(to) },
                ]), 2],
                [queryKey("events", [{ field: "startsAt", op: ">=", value: now }]), 4],
                [queryKey("events", [{ field: "startsAt", op: "<", value: now }]), 6],
                [queryKey("events", [{ field: "createdAt", op: ">=", value: sevenDaysAgo }]), 3],
            ]),
            docs: new Map([
                [queryKey("events", [
                    { field: "createdAt", op: ">=", value: new Date(from) },
                    { field: "createdAt", op: "<", value: new Date(to) },
                ]), [
                    { createdAt: "2026-02-03T10:00:00.000Z" },
                    { createdAt: "2026-02-10T10:00:00.000Z" },
                ]],
            ]),
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        const result = await getEventsAnalyticsService({ from, to, groupBy: "week" });

        expect(result.created.total).toBe(2);
        expect(result.summary).toEqual({
            upcoming: 4,
            past: 6,
            newLast7Days: 3,
        });
        expect(result.created.series).toEqual([
            { bucket: "2026-02-02T00:00:00.000Z", count: 1 },
            { bucket: "2026-02-09T00:00:00.000Z", count: 1 },
        ]);
    });

    it("groups platform analytics by eventName and timeline buckets", async () => {
        const from = "2026-02-01T00:00:00.000Z";
        const to = "2026-02-28T00:00:00.000Z";
        const state = {
            counts: new Map([
                [queryKey("analytics_events", [
                    { field: "timestamp", op: ">=", value: from },
                    { field: "timestamp", op: "<", value: to },
                ]), 4],
            ]),
            docs: new Map([
                [queryKey("analytics_events", [
                    { field: "timestamp", op: ">=", value: from },
                    { field: "timestamp", op: "<", value: to },
                ]), [
                    { eventName: "showroom_view", timestamp: "2026-02-05T10:00:00.000Z" },
                    { eventName: "showroom_view", timestamp: "2026-02-05T12:00:00.000Z" },
                    { eventName: "event_view", timestamp: "2026-02-07T09:00:00.000Z" },
                    { eventName: null, timestamp: "2026-02-07T11:00:00.000Z" },
                ]],
            ]),
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        const result = await getPlatformAnalyticsService({ from, to, groupBy: "day" });

        expect(result.total).toBe(4);
        expect(result.timeline).toEqual([
            { bucket: "2026-02-05T00:00:00.000Z", count: 2 },
            { bucket: "2026-02-07T00:00:00.000Z", count: 2 },
        ]);
        expect(result.byEventName).toEqual([
            { eventName: "showroom_view", count: 2 },
            { eventName: "event_view", count: 1 },
            { eventName: "unknown", count: 1 },
        ]);
    });
});
