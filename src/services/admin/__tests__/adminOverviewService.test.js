import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
}));

const { getAdminOverviewService } = await import("../adminOverviewService.js");

function keyFor(collectionName, filters = []) {
    return JSON.stringify({
        collectionName,
        filters: filters.map(f => ({
            field: f.field,
            op: f.op,
            value:
                f.value instanceof Date
                    ? `date:${f.value.toISOString()}`
                    : f.value,
        })),
    });
}

function makeQuery(collectionName, countsMap, filters = []) {
    return {
        where(field, op, value) {
            return makeQuery(collectionName, countsMap, [
                ...filters,
                { field, op, value },
            ]);
        },
        count() {
            return {
                async get() {
                    const key = keyFor(collectionName, filters);
                    const count = countsMap.has(key) ? countsMap.get(key) : 0;
                    return {
                        data: () => ({ count }),
                    };
                },
            };
        },
    };
}

function makeDb(countsMap) {
    return {
        collection(name) {
            return makeQuery(name, countsMap);
        },
    };
}

describe("getAdminOverviewService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns aggregated overview structure from count queries", async () => {
        const now = new Date("2026-02-26T12:00:00.000Z");
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const counts = new Map([
            [keyFor("showrooms"), 100],
            [keyFor("showrooms", [{ field: "status", op: "==", value: "pending" }]), 7],
            [keyFor("showrooms", [{ field: "status", op: "==", value: "approved" }]), 70],
            [keyFor("showrooms", [{ field: "status", op: "==", value: "rejected" }]), 12],
            [keyFor("showrooms", [{ field: "status", op: "==", value: "deleted" }]), 11],
            [keyFor("showrooms", [{ field: "createdAt", op: ">=", value: sevenDaysAgo }]), 9],
            [keyFor("events"), 40],
            [keyFor("events", [{ field: "startsAt", op: ">=", value: now }]), 15],
            [keyFor("events", [{ field: "startsAt", op: "<", value: now }]), 25],
            [keyFor("events", [{ field: "createdAt", op: ">=", value: sevenDaysAgo }]), 6],
            [keyFor("users"), 500],
            [keyFor("users", [{ field: "role", op: "==", value: "owner" }]), 73],
            [keyFor("users", [{ field: "createdAt", op: ">=", value: sevenDaysAgo }]), 18],
        ]);

        getFirestoreInstanceMock.mockReturnValue(makeDb(counts));

        const result = await getAdminOverviewService(now);

        expect(result).toEqual({
            showrooms: {
                total: 100,
                pending: 7,
                approved: 70,
                rejected: 12,
                deleted: 11,
                newLast7Days: 9,
            },
            events: {
                total: 40,
                upcoming: 15,
                past: 25,
                newLast7Days: 6,
            },
            users: {
                total: 500,
                owners: 73,
                newLast7Days: 18,
            },
        });
    });
});
