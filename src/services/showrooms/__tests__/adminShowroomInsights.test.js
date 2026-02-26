import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
}));

const {
    getAdminShowroomHistoryService,
    getAdminShowroomStatsService,
} = await import("../adminShowroomInsights.js");

function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeDocSnap(id, data) {
    return {
        id,
        exists: Boolean(data),
        data: () => (data ? deepClone(data) : undefined),
    };
}

function makeDb(state) {
    return {
        collection(name) {
            return {
                doc(id) {
                    return {
                        async get() {
                            if (name !== "showrooms") throw new Error(`Unsupported collection ${name}`);
                            const doc = (state.showrooms || []).find(item => item.id === id) ?? null;
                            return makeDocSnap(id, doc);
                        },
                    };
                },
            };
        },
    };
}

function makeShowroom(overrides = {}) {
    return {
        id: "sr-1",
        ownerUid: "owner-1",
        status: "approved",
        name: "Showroom",
        type: "unique",
        country: "Ukraine",
        city: "Kyiv",
        geo: {
            city: "Kyiv",
            cityNormalized: "kyiv",
            country: "Ukraine",
            geohash: "u8c",
        },
        contacts: {
            phone: "+380671234567",
            instagram: "https://instagram.com/showroom",
        },
        editCount: 5,
        createdAt: "2026-02-01T10:00:00.000Z",
        updatedAt: "2026-02-10T10:00:00.000Z",
        reviewedAt: "2026-02-09T10:00:00.000Z",
        reviewedBy: { uid: "admin-1", role: "admin" },
        editHistory: [
            {
                action: "submit",
                at: "2026-02-05T10:00:00.000Z",
                statusBefore: "draft",
                statusAfter: "pending",
            },
            {
                action: "reject",
                at: "2026-02-06T10:00:00.000Z",
                statusBefore: "pending",
                statusAfter: "rejected",
            },
            {
                action: "submit",
                at: "2026-02-07T10:00:00.000Z",
                statusBefore: "rejected",
                statusAfter: "pending",
            },
            {
                action: "approve",
                at: "2026-02-09T10:00:00.000Z",
                statusBefore: "pending",
                statusAfter: "approved",
            },
        ],
        ...overrides,
    };
}

describe("adminShowroomInsights services", () => {
    const admin = { uid: "admin-1", role: "admin" };
    const owner = { uid: "owner-1", role: "owner" };
    let state;

    beforeEach(() => {
        jest.clearAllMocks();
        state = {
            showrooms: [makeShowroom()],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));
    });

    it("history success returns newest-first sorted entries with total", async () => {
        const result = await getAdminShowroomHistoryService("sr-1", admin);

        expect(result.meta).toEqual({ total: 4 });
        expect(result.history.map(item => item.action)).toEqual([
            "approve",
            "submit",
            "reject",
            "submit",
        ]);
        expect(result.history[0].at).toBe("2026-02-09T10:00:00.000Z");
    });

    it("history empty returns [] and total=0", async () => {
        state.showrooms[0].editHistory = undefined;

        const result = await getAdminShowroomHistoryService("sr-1", admin);

        expect(result).toEqual({
            history: [],
            meta: { total: 0 },
        });
    });

    it("stats computes correct counts and lifecycle fields", async () => {
        const result = await getAdminShowroomStatsService("sr-1", admin);

        expect(result).toEqual({
            editCount: 5,
            moderation: {
                approveCount: 1,
                rejectCount: 1,
                submitCount: 2,
                lastReviewedAt: "2026-02-09T10:00:00.000Z",
                lastReviewedBy: { uid: "admin-1", role: "admin" },
            },
            lifecycle: {
                createdAt: "2026-02-01T10:00:00.000Z",
                lastUpdatedAt: "2026-02-10T10:00:00.000Z",
                currentStatus: "approved",
            },
        });
    });

    it("stats with no moderation actions returns zero moderation counts", async () => {
        state.showrooms[0] = makeShowroom({
            status: "draft",
            reviewedAt: null,
            reviewedBy: null,
            editCount: 0,
            editHistory: [{ action: "patch", at: "2026-02-02T10:00:00.000Z" }],
        });

        const result = await getAdminShowroomStatsService("sr-1", admin);

        expect(result.moderation).toEqual({
            approveCount: 0,
            rejectCount: 0,
            submitCount: 0,
            lastReviewedAt: null,
            lastReviewedBy: null,
        });
        expect(result.editCount).toBe(0);
    });

    it("throws SHOWROOM_NOT_FOUND when showroom is missing", async () => {
        await expect(getAdminShowroomHistoryService("missing", admin)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_FOUND",
        });
        await expect(getAdminShowroomStatsService("missing", admin)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_FOUND",
        });
    });

    it("throws FORBIDDEN for non-admin user", async () => {
        await expect(getAdminShowroomHistoryService("sr-1", owner)).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
        await expect(getAdminShowroomStatsService("sr-1", owner)).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("does not mutate showroom state when reading history/stats", async () => {
        const before = deepClone(state);

        await getAdminShowroomHistoryService("sr-1", admin);
        await getAdminShowroomStatsService("sr-1", admin);

        expect(state).toEqual(before);
    });
});
