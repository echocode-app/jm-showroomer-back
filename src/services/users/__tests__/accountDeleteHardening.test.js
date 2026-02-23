import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
}));

const profileService = await import("../profileService.js");
const { assertUserWritable } = await import("../writeGuardService.js");
const { createDraftShowroom } = await import("../../showrooms/createDraftShowroom.js");

function makeDocSnap(id, data) {
    return {
        id,
        exists: Boolean(data),
        data: () => (data ? { ...data } : undefined),
        get: key => data?.[key],
    };
}

function makeDb(state) {
    function getCollectionDocs(name) {
        if (name === "users") {
            return Object.entries(state.users || {}).map(([id, data]) => ({ id, data }));
        }
        return (state[name] || []).map(doc => ({ ...doc }));
    }

    function applyQuery(query) {
        let docs = getCollectionDocs(query.collectionName);
        docs = docs.filter(doc => {
            return query.filters.every(filter => {
                const value = doc[filter.field];
                if (filter.op === "==") return value === filter.value;
                if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(value);
                throw new Error(`Unsupported op ${filter.op}`);
            });
        });
        if (typeof query.limitN === "number") {
            docs = docs.slice(0, query.limitN);
        }
        return {
            empty: docs.length === 0,
            docs: docs.map(doc => ({
                id: doc.id,
                data: () => ({ ...doc }),
            })),
        };
    }

    function makeQuery(collectionName, filters = [], limitN = null) {
        return {
            _kind: "query",
            collectionName,
            filters,
            limitN,
            where(field, op, value) {
                return makeQuery(collectionName, [...filters, { field, op, value }], limitN);
            },
            limit(n) {
                return makeQuery(collectionName, filters, n);
            },
            async get() {
                return applyQuery(this);
            },
        };
    }

    function makeDocRef(collectionName, id) {
        return {
            _kind: "doc",
            collectionName,
            id,
            path: `${collectionName}/${id}`,
            async get() {
                if (collectionName === "users") {
                    return makeDocSnap(id, state.users?.[id] ?? null);
                }
                const doc = (state[collectionName] || []).find(item => item.id === id) || null;
                return makeDocSnap(id, doc);
            },
            async update(patch) {
                if (collectionName !== "users") {
                    const idx = (state[collectionName] || []).findIndex(item => item.id === id);
                    if (idx < 0) throw new Error("not found");
                    state[collectionName][idx] = { ...state[collectionName][idx], ...patch };
                    return;
                }
                if (!state.users?.[id]) throw new Error("not found");
                state.users[id] = { ...state.users[id], ...patch };
            },
        };
    }

    const db = {
        collection(name) {
            const baseQuery = makeQuery(name);
            return {
                doc(id) {
                    return makeDocRef(name, id);
                },
                where: baseQuery.where,
                limit: baseQuery.limit,
            };
        },
        async runTransaction(callback) {
            const pending = [];
            const tx = {
                async get(target) {
                    if (target?._kind === "doc") return target.get();
                    if (target?._kind === "query") return target.get();
                    throw new Error("Unsupported tx.get target");
                },
                update(ref, patch) {
                    pending.push({ type: "update", ref, patch });
                },
                set(ref, data) {
                    pending.push({ type: "set", ref, data });
                },
            };
            const result = await callback(tx);
            for (const op of pending) {
                if (op.type === "update") {
                    await op.ref.update(op.patch);
                    continue;
                }
                if (op.type === "set") {
                    const { collectionName, id } = op.ref;
                    if (!state[collectionName]) state[collectionName] = [];
                    if (collectionName === "users") {
                        state.users[id] = { ...(state.users[id] || {}), ...op.data };
                    } else {
                        state[collectionName].push({ id, ...op.data });
                    }
                }
            }
            return result;
        },
    };

    return db;
}

describe("account delete hardening", () => {
    beforeEach(() => {
        getFirestoreInstanceMock.mockReset();
    });

    it("blocks deletion when user owns an event (future-proof blocker)", async () => {
        const state = {
            users: { u1: { uid: "u1", isDeleted: false } },
            showrooms: [],
            lookbooks: [],
            events: [{ id: "ev-1", ownerUid: "u1" }],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        const result = await profileService.deleteUserAccountWithBlockGuard("u1");

        expect(result.status).toBe("blocked");
        expect(result.blockers.events).toBe(true);
        expect(state.users.u1.isDeleted).not.toBe(true);
        expect(state.users.u1.deleteLock).toBeNull();
    });

    it("allows deletion when user owns only deleted showrooms", async () => {
        const state = {
            users: { u1: { uid: "u1", isDeleted: false } },
            showrooms: [{ id: "sr-1", ownerUid: "u1", status: "deleted" }],
            lookbooks: [],
            events: [],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        const result = await profileService.deleteUserAccountWithBlockGuard("u1");

        expect(result.status).toBe("deleted");
        expect(state.users.u1.isDeleted).toBe(true);
        expect(state.users.u1.deleteLock).toBeNull();
        expect(typeof state.users.u1.deletedAt).toBe("string");
    });

    it("blocks deletion for lookbooks using canonical authorId ownership", async () => {
        const state = {
            users: { u1: { uid: "u1", isDeleted: false } },
            showrooms: [],
            lookbooks: [{ id: "lb-1", authorId: "u1", published: true }],
            events: [],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        const result = await profileService.deleteUserAccountWithBlockGuard("u1");

        expect(result.status).toBe("blocked");
        expect(result.blockers.lookbooks).toBe(true);
    });

    it("treats deleteLock as non-writable for concurrent write guards", async () => {
        const state = {
            users: { u1: { uid: "u1", isDeleted: false, deleteLock: true } },
            showrooms: [],
            lookbooks: [],
            events: [],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        await expect(assertUserWritable("u1")).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
        await expect(createDraftShowroom("u1")).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    });

    it("is idempotent when account is already deleted", async () => {
        const state = {
            users: { u1: { uid: "u1", isDeleted: true, deletedAt: "2026-01-01T00:00:00.000Z" } },
            showrooms: [],
            lookbooks: [],
            events: [],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        const result = await profileService.deleteUserAccountWithBlockGuard("u1");

        expect(result).toEqual({ status: "already_deleted" });
    });

    it("treats concurrent double delete as in-progress/already-deleted, not blocker", async () => {
        const state = {
            users: {
                u1: { uid: "u1", isDeleted: false, deleteLock: true, deleteLockAt: "2026-02-23T11:00:00.000Z" },
            },
            showrooms: [],
            lookbooks: [],
            events: [],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        setTimeout(() => {
            state.users.u1 = {
                ...state.users.u1,
                isDeleted: true,
                deleteLock: null,
                deletedAt: "2026-02-23T11:00:00.100Z",
            };
        }, 10);

        const result = await profileService.deleteUserAccountWithBlockGuard("u1");
        expect(["already_deleted", "delete_in_progress"]).toContain(result.status);
        expect(result.status).not.toBe("blocked");
    });
});
