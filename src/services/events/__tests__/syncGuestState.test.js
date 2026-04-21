import { jest } from "@jest/globals";

const docs = new Map();
const txOperations = [];

function makeSnap(ref) {
    const value = docs.get(ref.path);
    return {
        id: ref.id,
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
            return {
                doc(id) {
                    return makeDocRef(`${path}/${name}/${id}`);
                },
            };
        },
    };
}

function makeCollectionRef(name) {
    return {
        doc(id) {
            return makeDocRef(`${name}/${id}`);
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
}));

jest.unstable_mockModule("../../users/writeGuardService.js", () => ({
    assertUserWritable: jest.fn(async () => ({ uid: "user-1" })),
    assertUserWritableInTx: jest.fn(async () => ({ uid: "user-1" })),
}));

jest.unstable_mockModule("../firestoreQuery.js", () => ({
    getEventsCollection: () => makeCollectionRef("events"),
}));

const { syncGuestEventsState } = await import("../syncGuestState.js");

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
});
