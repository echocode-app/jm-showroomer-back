import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
}));

jest.unstable_mockModule("../../../config/logger.js", () => ({
    log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.unstable_mockModule("../../notifications/notificationService.js", () => ({
    createNotification: jest.fn(),
}));

const { favoriteShowroom } = await import("../userShowroomState.js");

function makeDocSnap(id, data) {
    return {
        id,
        exists: Boolean(data),
        data: () => (data ? { ...data } : undefined),
        get: key => data?.[key],
    };
}

function makeDb(state) {
    function userSubDocRef(uid, subcollection, docId) {
        return {
            _kind: "doc",
            path: `users/${uid}/${subcollection}/${docId}`,
            async get() {
                const doc = state.userSubs?.[uid]?.[subcollection]?.[docId] ?? null;
                return makeDocSnap(docId, doc);
            },
        };
    }

    function userDocRef(uid) {
        return {
            _kind: "doc",
            path: `users/${uid}`,
            async get() {
                return makeDocSnap(uid, state.users?.[uid] ?? null);
            },
            collection(subcollection) {
                return {
                    doc(docId) {
                        return userSubDocRef(uid, subcollection, docId);
                    },
                };
            },
        };
    }

    function showroomDocRef(id) {
        return {
            _kind: "doc",
            path: `showrooms/${id}`,
            async get() {
                const doc = (state.showrooms || []).find(item => item.id === id) ?? null;
                return makeDocSnap(id, doc);
            },
        };
    }

    return {
        collection(name) {
            if (name === "users") {
                return {
                    doc(uid) {
                        return userDocRef(uid);
                    },
                };
            }
            if (name === "showrooms") {
                return {
                    doc(id) {
                        return showroomDocRef(id);
                    },
                };
            }
            throw new Error(`Unsupported collection ${name}`);
        },
        async runTransaction(callback) {
            const pending = [];
            const tx = {
                async get(ref) {
                    return ref.get();
                },
                set(ref, data) {
                    pending.push({ type: "set", ref, data });
                },
                delete(ref) {
                    pending.push({ type: "delete", ref });
                },
            };

            const result = await callback(tx);
            for (const op of pending) {
                if (op.type === "set") {
                    const match = op.ref.path.match(/^users\/([^/]+)\/([^/]+)\/([^/]+)$/);
                    if (!match) continue;
                    const [, uid, subcollection, docId] = match;
                    state.userSubs ??= {};
                    state.userSubs[uid] ??= {};
                    state.userSubs[uid][subcollection] ??= {};
                    state.userSubs[uid][subcollection][docId] = {
                        ...(state.userSubs[uid][subcollection][docId] || {}),
                        ...op.data,
                    };
                    continue;
                }
                if (op.type === "delete") {
                    const match = op.ref.path.match(/^users\/([^/]+)\/([^/]+)\/([^/]+)$/);
                    if (!match) continue;
                    const [, uid, subcollection, docId] = match;
                    delete state.userSubs?.[uid]?.[subcollection]?.[docId];
                }
            }
            return result;
        },
    };
}

describe("showroom favorites delete-lock guard", () => {
    beforeEach(() => {
        getFirestoreInstanceMock.mockReset();
    });

    it("rejects favoriteShowroom when user is delete-locked", async () => {
        const state = {
            users: {
                u1: { uid: "u1", isDeleted: false, deleteLock: true },
            },
            showrooms: [
                { id: "sr-1", status: "approved", ownerUid: "owner-1", name: "Showroom A" },
            ],
            userSubs: {},
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));

        await expect(favoriteShowroom("u1", "sr-1")).rejects.toMatchObject({
            code: "USER_NOT_FOUND",
        });
        expect(state.userSubs.u1?.showrooms_favorites?.["sr-1"]).toBeUndefined();
    });
});

