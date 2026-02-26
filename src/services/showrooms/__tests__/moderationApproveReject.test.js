import { jest } from "@jest/globals";
import { getStatusForCode } from "../../../core/errorCodes.js";

const getFirestoreInstanceMock = jest.fn();
const assertUserWritableMock = jest.fn(async () => {});
const assertUserWritableInTxMock = jest.fn(async () => {});
const createNotificationMock = jest.fn(async () => ({ created: true, pushed: false }));

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
}));

jest.unstable_mockModule("../../../config/logger.js", () => ({
    log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.unstable_mockModule("../../users/writeGuardService.js", () => ({
    assertUserWritable: assertUserWritableMock,
    assertUserWritableInTx: assertUserWritableInTxMock,
}));

jest.unstable_mockModule("../../notifications/notificationService.js", () => ({
    createNotification: createNotificationMock,
}));

const { approveShowroomService } = await import("../approveShowroom.js");
const { rejectShowroomService } = await import("../rejectShowroom.js");

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

function shouldResolveServerTimestamp(value) {
    if (value == null) return false;
    if (typeof value === "string") return false;
    if (value instanceof Date) return false;
    if (typeof value?.toDate === "function") return false;
    return typeof value === "object";
}

const SERVER_TIMESTAMP_FIELDS = new Set([
    "createdAt",
    "updatedAt",
    "submittedAt",
    "reviewedAt",
    "deletedAt",
]);

function mergePatchWithServerTimestamps(baseDoc, patch, nowIso) {
    const next = { ...baseDoc };
    for (const [key, value] of Object.entries(patch || {})) {
        next[key] =
            SERVER_TIMESTAMP_FIELDS.has(key) && shouldResolveServerTimestamp(value)
                ? nowIso
                : deepClone(value);
    }
    return next;
}

function makeDb(state, options = {}) {
    let tsCounter = 0;
    const nextIso = () => {
        const base = Date.parse("2026-02-26T10:00:00.000Z");
        const iso = new Date(base + tsCounter * 1000).toISOString();
        tsCounter += 1;
        return iso;
    };

    function getUser(id) {
        return state.users?.[id] ?? null;
    }

    function getShowroom(id) {
        return (state.showrooms || []).find(doc => doc.id === id) ?? null;
    }

    function setShowroom(id, patch) {
        const idx = (state.showrooms || []).findIndex(doc => doc.id === id);
        if (idx < 0) throw new Error(`showrooms/${id} not found`);
        const current = state.showrooms[idx];
        state.showrooms[idx] = mergePatchWithServerTimestamps(current, patch, nextIso());
    }

    function makeDocRef(collectionName, id) {
        return {
            _kind: "doc",
            collectionName,
            id,
            path: `${collectionName}/${id}`,
            async get() {
                if (collectionName === "users") return makeDocSnap(id, getUser(id));
                if (collectionName === "showrooms") return makeDocSnap(id, getShowroom(id));
                throw new Error(`Unsupported collection ${collectionName}`);
            },
            async update(patch) {
                if (collectionName === "showrooms") {
                    setShowroom(id, patch);
                    return;
                }
                if (collectionName === "users") {
                    state.users[id] = { ...(state.users[id] || {}), ...deepClone(patch) };
                    return;
                }
                throw new Error(`Unsupported collection ${collectionName}`);
            },
        };
    }

    async function runTransaction(callback) {
        const maxAttempts = options.retryOnce ? 2 : 1;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const pendingOps = [];
            const tx = {
                async get(target) {
                    if (target?._kind !== "doc") throw new Error("Unsupported tx.get target");
                    return target.get();
                },
                update(ref, patch) {
                    pendingOps.push({ ref, patch });
                },
            };

            const result = await callback(tx);

            if (options.retryOnce && attempt === 0) {
                options.beforeRetry?.(state);
                continue;
            }

            for (const op of pendingOps) {
                await op.ref.update(op.patch);
            }
            return result;
        }
        return undefined;
    }

    return {
        collection(name) {
            return {
                doc(id) {
                    return makeDocRef(name, id);
                },
            };
        },
        runTransaction,
    };
}

function makePendingShowroom(overrides = {}) {
    return {
        id: "sr-1",
        ownerUid: "owner-1",
        status: "pending",
        name: "Canonical Name",
        nameNormalized: "canonical-name",
        type: "unique",
        availability: "offline",
        category: "fashion",
        categoryGroup: "clothing",
        subcategories: ["dresses"],
        brands: ["Brand"],
        brandsNormalized: ["brand"],
        brandsMap: { brand: true },
        address: "Addr 1",
        addressNormalized: "addr-1",
        country: "Ukraine",
        city: "Kyiv",
        contacts: { instagram: "https://instagram.com/test" },
        location: { lat: 50.45, lng: 30.52 },
        geo: { city: "Kyiv", country: "Ukraine", geohash: "u8c", cityNormalized: "kyiv" },
        reviewReason: "old reject reason",
        pendingSnapshot: {
            name: "Pending Name",
            nameNormalized: "pending-name",
            address: "Pending Addr",
            addressNormalized: "pending-addr",
            ownerUid: "owner-1",
        },
        editCount: 2,
        editHistory: [
            { action: "submit", statusBefore: "draft", statusAfter: "pending", changedFields: ["status"] },
        ],
        createdAt: "2026-02-25T10:00:00.000Z",
        updatedAt: "2026-02-25T10:00:00.000Z",
        submittedAt: "2026-02-25T10:00:00.000Z",
        ...overrides,
    };
}

describe("approveShowroomService", () => {
    const admin = { uid: "admin-1", role: "admin" };
    let state;

    beforeEach(() => {
        jest.clearAllMocks();
        state = {
            users: {
                "admin-1": { uid: "admin-1", role: "admin", isDeleted: false, deleteLock: false },
                "owner-1": { uid: "owner-1", role: "owner", isDeleted: false, deleteLock: false },
            },
            showrooms: [makePendingShowroom()],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));
    });

    it("approves pending showroom successfully and preserves service return shape", async () => {
        await expect(approveShowroomService("sr-1", admin)).resolves.toEqual({ statusChanged: true });

        const showroom = state.showrooms[0];
        expect(showroom.status).toBe("approved");
        expect(showroom.name).toBe("Pending Name");
        expect(showroom.address).toBe("Pending Addr");
        expect(showroom.reviewedBy).toEqual({ uid: "admin-1", role: "admin" });
        expect(showroom.reviewedAt).toEqual(expect.any(String));
    });

    it("fails for non-pending showroom with SHOWROOM_NOT_EDITABLE", async () => {
        state.showrooms[0].status = "approved";

        await expect(approveShowroomService("sr-1", admin)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_EDITABLE",
        });
    });

    it("fails when pendingSnapshot is missing", async () => {
        state.showrooms[0].pendingSnapshot = null;

        await expect(approveShowroomService("sr-1", admin)).rejects.toMatchObject({
            code: "SHOWROOM_PENDING_SNAPSHOT_MISSING",
        });
    });

    it("clears stale reviewReason on approve", async () => {
        state.showrooms[0].reviewReason = "previous reject reason";

        await approveShowroomService("sr-1", admin);

        expect(state.showrooms[0].reviewReason).toBeNull();
    });

    it("increments editCount on approve", async () => {
        state.showrooms[0].editCount = 7;

        await approveShowroomService("sr-1", admin);

        expect(state.showrooms[0].editCount).toBe(8);
    });

    it("appends editHistory on approve", async () => {
        const beforeLen = state.showrooms[0].editHistory.length;

        await approveShowroomService("sr-1", admin);

        const history = state.showrooms[0].editHistory;
        expect(history).toHaveLength(beforeLen + 1);
        expect(history.at(-1)).toEqual(
            expect.objectContaining({
                action: "approve",
                statusBefore: "pending",
                statusAfter: "approved",
            })
        );
    });

    it("double approve: second call fails", async () => {
        await approveShowroomService("sr-1", admin);

        await expect(approveShowroomService("sr-1", admin)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_EDITABLE",
        });
    });

    it("simulates concurrent approve via transaction retry and fails with SHOWROOM_NOT_EDITABLE", async () => {
        getFirestoreInstanceMock.mockReturnValue(
            makeDb(state, {
                retryOnce: true,
                beforeRetry(currentState) {
                    currentState.showrooms[0] = {
                        ...currentState.showrooms[0],
                        status: "approved",
                        pendingSnapshot: null,
                    };
                },
            })
        );

        await expect(approveShowroomService("sr-1", admin)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_EDITABLE",
        });
        expect(state.showrooms[0].status).toBe("approved");
    });
});

describe("rejectShowroomService", () => {
    const admin = { uid: "admin-1", role: "admin" };
    let state;

    beforeEach(() => {
        jest.clearAllMocks();
        state = {
            users: {
                "admin-1": { uid: "admin-1", role: "admin", isDeleted: false, deleteLock: false },
                "owner-1": { uid: "owner-1", role: "owner", isDeleted: false, deleteLock: false },
            },
            showrooms: [makePendingShowroom()],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));
    });

    it("rejects pending showroom successfully and preserves service return shape", async () => {
        await expect(rejectShowroomService("sr-1", "Invalid docs", admin)).resolves.toEqual({
            statusChanged: true,
        });

        expect(state.showrooms[0].status).toBe("rejected");
        expect(state.showrooms[0].reviewReason).toBe("Invalid docs");
        expect(state.showrooms[0].reviewedBy).toEqual({ uid: "admin-1", role: "admin" });
    });

    it("trims reject reason before storing and notifying", async () => {
        await rejectShowroomService("sr-1", "  Need clearer photos  ", admin);

        expect(state.showrooms[0].reviewReason).toBe("Need clearer photos");
        expect(createNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({ reason: "Need clearer photos" }),
            })
        );
    });

    it("rejects short reason with VALIDATION_ERROR", async () => {
        await expect(rejectShowroomService("sr-1", " a ", admin)).rejects.toMatchObject({
            code: "VALIDATION_ERROR",
        });
    });

    it("fails reject for non-pending showroom with SHOWROOM_NOT_EDITABLE", async () => {
        state.showrooms[0].status = "approved";

        await expect(rejectShowroomService("sr-1", "Reason ok", admin)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_EDITABLE",
        });
    });

    it("increments editCount on reject", async () => {
        state.showrooms[0].editCount = 3;

        await rejectShowroomService("sr-1", "Reason ok", admin);

        expect(state.showrooms[0].editCount).toBe(4);
    });

    it("clears pendingSnapshot on reject", async () => {
        await rejectShowroomService("sr-1", "Reason ok", admin);

        expect(state.showrooms[0].pendingSnapshot).toBeNull();
    });

    it("double reject: second call fails", async () => {
        await rejectShowroomService("sr-1", "Reason ok", admin);

        await expect(rejectShowroomService("sr-1", "Another reason", admin)).rejects.toMatchObject({
            code: "SHOWROOM_NOT_EDITABLE",
        });
    });
});

describe("moderation service integrity checks", () => {
    it("keeps error code HTTP mappings unchanged for moderation-related cases", () => {
        expect(getStatusForCode("SHOWROOM_NOT_EDITABLE")).toBe(400);
        expect(getStatusForCode("SHOWROOM_PENDING_SNAPSHOT_MISSING")).toBe(409);
        expect(getStatusForCode("VALIDATION_ERROR")).toBe(400);
        expect(getStatusForCode("SHOWROOM_NOT_FOUND")).toBe(404);
        expect(getStatusForCode("FORBIDDEN")).toBe(403);
    });
});
