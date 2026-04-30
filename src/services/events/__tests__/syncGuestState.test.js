import { jest } from "@jest/globals";

const docs = new Map();
const txOperations = [];

function makeSnap(ref) {
    const value = docs.get(ref.path);
    return {
        id: ref.id,
        ref,
        exists: value !== undefined,
        data: () => value,
    };
}

function makeDocRef(path) {
    const parts = path.split("/");
    return {
        id: parts[parts.length - 1],
        path,
        collection(name) {
            return makeCollectionRef(`${path}/${name}`);
        },
    };
}

function makeCollectionRef(name) {
    const path = name;
    return {
        doc(id) {
            return makeDocRef(`${path}/${id}`);
        },
        orderBy(field, direction = "asc") {
            return makeQuery(path, field, direction);
        },
    };
}

function makeQuery(collectionPath, orderField, direction) {
    return {
        async get() {
            const prefix = `${collectionPath}/`;
            const snapshots = [];
            for (const [path, value] of docs.entries()) {
                if (!path.startsWith(prefix)) continue;
                const rest = path.slice(prefix.length);
                if (rest.includes("/")) continue;
                snapshots.push(makeSnap(makeDocRef(path)));
            }
            snapshots.sort((left, right) => {
                const leftValue = normalizeSortValue(left.data()?.[orderField]);
                const rightValue = normalizeSortValue(right.data()?.[orderField]);
                if (leftValue < rightValue) return direction === "desc" ? 1 : -1;
                if (leftValue > rightValue) return direction === "desc" ? -1 : 1;
                return left.id.localeCompare(right.id);
            });
            return { docs: snapshots };
        },
    };
}

const fakeDb = {
    collection: makeCollectionRef,
    async getAll(...refs) {
        return refs.map(makeSnap);
    },
    async runTransaction(callback) {
        let wrote = false;
        const tx = {
            async get(ref) {
                if (wrote) {
                    throw new Error(`read-after-write:${ref.path}`);
                }
                txOperations.push(["get", ref.path]);
                return makeSnap(ref);
            },
            set(ref, data) {
                wrote = true;
                txOperations.push(["set", ref.path, data]);
            },
            delete(ref) {
                wrote = true;
                txOperations.push(["delete", ref.path]);
            },
            update(ref, data) {
                wrote = true;
                txOperations.push(["update", ref.path, data]);
            },
        };
        return callback(tx);
    },
};

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: () => fakeDb,
    getMessagingInstance: () => null,
}));

jest.unstable_mockModule("../../users/writeGuardService.js", () => ({
    assertUserWritable: jest.fn(async () => ({ uid: "user-1" })),
    assertUserWritableInTx: jest.fn(async () => ({ uid: "user-1" })),
}));

jest.unstable_mockModule("../firestoreQuery.js", () => ({
    getEventsCollection: () => makeCollectionRef("events"),
}));

const { syncGuestEventsState } = await import("../syncGuestState.js");
const { listWantToVisitEvents } = await import("../userEventState.js");

function normalizeSortValue(value) {
    if (typeof value === "string") return Date.parse(value) || value;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?._seconds === "number") return value._seconds * 1000;
    return 0;
}

function futureDate() {
    return new Date(Date.now() + 86_400_000);
}

describe("syncGuestEventsState", () => {
    beforeEach(() => {
        docs.clear();
        txOperations.length = 0;
    });

    it("syncs multiple want-to-visit event ids without transaction read-after-write", async () => {
        docs.set("events/event-1", {
            id: "event-1",
            status: "published",
            country: "Ukraine",
            startsAt: futureDate(),
            wantToVisitCount: 0,
        });
        docs.set("events/event-2", {
            id: "event-2",
            status: "published",
            country: "Ukraine",
            startsAt: futureDate(),
            wantToVisitCount: 4,
        });

        const result = await syncGuestEventsState("user-1", {
            wantToVisitIds: ["event-1", "event-2"],
            dismissedIds: [],
        });

        expect(result.applied.wantToVisit).toEqual(["event-1", "event-2"]);
        expect(result.skipped).toEqual([]);
        expect(txOperations).toEqual([
            ["get", "events/event-1"],
            ["get", "users/user-1/events_want_to_visit/event-1"],
            ["get", "events/event-2"],
            ["get", "users/user-1/events_want_to_visit/event-2"],
            ["set", "users/user-1/events_want_to_visit/event-1", expect.any(Object)],
            ["delete", "users/user-1/events_dismissed/event-1"],
            ["update", "events/event-1", { wantToVisitCount: 1 }],
            ["set", "users/user-1/events_want_to_visit/event-2", expect.any(Object)],
            ["delete", "users/user-1/events_dismissed/event-2"],
            ["update", "events/event-2", { wantToVisitCount: 5 }],
        ]);
    });

    it("returns additive cursor paging meta for want-to-visit collection", async () => {
        docs.set("users/user-1/events_want_to_visit/event-1", { createdAt: "2026-01-01T00:00:00.000Z" });
        docs.set("users/user-1/events_want_to_visit/event-2", { createdAt: "2026-01-02T00:00:00.000Z" });
        docs.set("users/user-1/events_want_to_visit/event-3", { createdAt: "2026-01-03T00:00:00.000Z" });
        docs.set("events/event-1", {
            id: "event-1",
            status: "published",
            country: "Ukraine",
            startsAt: new Date(Date.now() + 86_400_000),
        });
        docs.set("events/event-2", {
            id: "event-2",
            status: "published",
            country: "Ukraine",
            startsAt: new Date(Date.now() + 172_800_000),
        });
        docs.set("events/event-3", {
            id: "event-3",
            status: "published",
            country: "Ukraine",
            startsAt: new Date(Date.now() + 259_200_000),
        });

        const firstPage = await listWantToVisitEvents("user-1", { limit: "2" });

        expect(firstPage.events.map(event => event.id)).toEqual(["event-1", "event-2"]);
        expect(firstPage.meta).toEqual({
            total: 3,
            returned: 2,
            hasMore: true,
            nextCursor: expect.any(String),
            paging: "enabled",
        });

        const secondPage = await listWantToVisitEvents("user-1", {
            limit: "2",
            cursor: firstPage.meta.nextCursor,
        });

        expect(secondPage.events.map(event => event.id)).toEqual(["event-3"]);
        expect(secondPage.meta).toEqual({
            total: 3,
            returned: 1,
            hasMore: false,
            nextCursor: null,
            paging: "end",
        });
    });
});
