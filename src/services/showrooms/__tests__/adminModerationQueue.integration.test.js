import { jest } from "@jest/globals";

const getFirestoreInstanceMock = jest.fn();
const assertUserWritableInTxMock = jest.fn(async () => {});
const assertUserWritableMock = jest.fn(async () => {});
const recordMock = jest.fn(async () => {});

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
    getAuthInstance: jest.fn(),
    getStorageInstance: jest.fn(),
    getMessagingInstance: jest.fn(),
    initFirebase: jest.fn(),
}));

jest.unstable_mockModule("../../../config/logger.js", () => ({
    log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.unstable_mockModule("../../users/writeGuardService.js", () => ({
    assertUserWritableInTx: assertUserWritableInTxMock,
    assertUserWritable: assertUserWritableMock,
}));

jest.unstable_mockModule("../../analytics/analyticsEventBuilder.js", () => ({
    buildAnalyticsEvent: jest.fn(payload => payload),
}));

jest.unstable_mockModule("../../analytics/analyticsEventService.js", () => ({
    record: recordMock,
}));

jest.unstable_mockModule("../../analytics/eventNames.js", () => ({
    ANALYTICS_EVENTS: {
        SHOWROOM_SUBMIT_FOR_REVIEW: "showroom_submit_for_review",
    },
}));

const { submitShowroomForReviewService } = await import("../submitShowroomForReview.js");
const {
    listAdminModerationQueueService,
    encodeAdminModerationCursor,
} = await import("../adminModerationQueue.js");
const { listShowroomsAdmin } = await import("../../../controllers/adminShowroomController.js");

function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getValueByPath(doc, path) {
    if (path === "__name__") return doc.id;
    if (!path || typeof path !== "string") return undefined;
    return path.split(".").reduce((acc, key) => acc?.[key], doc);
}

function normalizeOrderField(field) {
    return typeof field === "string" ? field : "__name__";
}

function compareValues(a, b, direction = "asc") {
    if (a === b) return 0;
    if (a == null && b == null) return 0;
    if (a == null) return direction === "asc" ? -1 : 1;
    if (b == null) return direction === "asc" ? 1 : -1;
    return (a < b ? -1 : 1) * (direction === "asc" ? 1 : -1);
}

function makeDocSnap(id, data) {
    return {
        id,
        exists: Boolean(data),
        data: () => (data ? deepClone(data) : undefined),
        get: key => data?.[key],
    };
}

function makeDb(state) {
    let serverTsCounter = 0;

    function nextServerTimestampIso() {
        const base = Date.parse("2026-02-25T12:00:00.000Z");
        const iso = new Date(base + serverTsCounter * 1000).toISOString();
        serverTsCounter += 1;
        return iso;
    }

    function getCollectionDocs(name) {
        if (name === "users") {
            return Object.entries(state.users || {}).map(([id, data]) => ({ id, ...deepClone(data) }));
        }
        return (state[name] || []).map(doc => deepClone(doc));
    }

    function applyFilters(docs, filters) {
        return docs.filter(doc => {
            return filters.every(filter => {
                const left = getValueByPath(doc, filter.field);
                if (filter.op === "==") return left === filter.value;
                throw new Error(`Unsupported where op ${filter.op}`);
            });
        });
    }

    function applyOrderBys(docs, orderBys) {
        if (!orderBys.length) return docs;
        return [...docs].sort((a, b) => {
            for (const ob of orderBys) {
                const cmp = compareValues(
                    getValueByPath(a, ob.field),
                    getValueByPath(b, ob.field),
                    ob.direction
                );
                if (cmp !== 0) return cmp;
            }
            return 0;
        });
    }

    function applyStartAfter(docs, orderBys, startAfterTuple) {
        if (!startAfterTuple || !orderBys.length) return docs;
        return docs.filter(doc => {
            for (let i = 0; i < orderBys.length; i += 1) {
                const ob = orderBys[i];
                const docValue = getValueByPath(doc, ob.field);
                const cursorValue = startAfterTuple[i];
                const cmp = compareValues(docValue, cursorValue, ob.direction);
                if (cmp > 0) return true;
                if (cmp < 0) return false;
            }
            return false;
        });
    }

    function makeQuery(collectionName, { filters = [], orderBys = [], limitN = null, startAfterTuple = null } = {}) {
        return {
            _kind: "query",
            collectionName,
            filters,
            orderBys,
            limitN,
            startAfterTuple,
            where(field, op, value) {
                return makeQuery(collectionName, {
                    filters: [...filters, { field, op, value }],
                    orderBys,
                    limitN,
                    startAfterTuple,
                });
            },
            orderBy(field, direction = "asc") {
                return makeQuery(collectionName, {
                    filters,
                    orderBys: [...orderBys, { field: normalizeOrderField(field), direction }],
                    limitN,
                    startAfterTuple,
                });
            },
            startAfter(...values) {
                return makeQuery(collectionName, {
                    filters,
                    orderBys,
                    limitN,
                    startAfterTuple: values,
                });
            },
            limit(n) {
                return makeQuery(collectionName, { filters, orderBys, limitN: n, startAfterTuple });
            },
            async get() {
                let docs = getCollectionDocs(collectionName);
                docs = applyFilters(docs, filters);
                docs = applyOrderBys(docs, orderBys);
                docs = applyStartAfter(docs, orderBys, startAfterTuple);
                if (typeof limitN === "number") {
                    docs = docs.slice(0, limitN);
                }
                return {
                    empty: docs.length === 0,
                    docs: docs.map(doc => ({
                        id: doc.id,
                        data: () => {
                            const { id, ...data } = doc;
                            return deepClone(data);
                        },
                    })),
                };
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
                const doc = (state[collectionName] || []).find(item => item.id === id) ?? null;
                return makeDocSnap(id, doc);
            },
            async update(patch) {
                if (collectionName === "users") {
                    state.users[id] = { ...(state.users[id] || {}), ...deepClone(patch) };
                    return;
                }

                const idx = (state[collectionName] || []).findIndex(item => item.id === id);
                if (idx < 0) throw new Error(`${collectionName}/${id} not found`);

                const resolved = { ...patch };
                const commitIso = nextServerTimestampIso();
                if (shouldResolveServerTimestamp(resolved.submittedAt)) {
                    resolved.submittedAt = commitIso;
                }
                if (shouldResolveServerTimestamp(resolved.updatedAt)) {
                    resolved.updatedAt = commitIso;
                }

                state[collectionName][idx] = {
                    ...state[collectionName][idx],
                    ...deepClone(resolved),
                };
            },
        };
    }

    return {
        collection(name) {
            const query = makeQuery(name);
            return {
                doc(id) {
                    return makeDocRef(name, id);
                },
                where: query.where,
                orderBy: query.orderBy,
                limit: query.limit,
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
            };

            const result = await callback(tx);
            for (const op of pending) {
                if (op.type === "update") {
                    await op.ref.update(op.patch);
                }
            }
            return result;
        },
    };
}

function shouldResolveServerTimestamp(value) {
    if (value == null) return false;
    if (typeof value === "string") return false;
    if (value instanceof Date) return false;
    if (typeof value?.toDate === "function") return false;
    return typeof value === "object";
}

function makeDraftShowroom(id, ownerUid, name, address) {
    return {
        id,
        ownerUid,
        status: "draft",
        name,
        type: "unique",
        country: "Ukraine",
        city: "Kyiv",
        address,
        availability: "offline",
        contacts: {
            phone: "+380671234567",
            instagram: "https://www.instagram.com/showroom.test/",
        },
        location: { lat: 50.45, lng: 30.52 },
        geo: {
            city: "Kyiv",
            cityNormalized: "kyiv",
            country: "Ukraine",
            geohash: "u8c",
        },
        brands: ["Brand"],
        createdAt: "2026-02-25T11:00:00.000Z",
        updatedAt: "2026-02-25T11:00:00.000Z",
        editCount: 0,
        editHistory: [],
    };
}

function makeRes() {
    const res = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
    return res;
}

describe("admin moderation queue integration", () => {
    let state;
    const owner = { uid: "owner-1", role: "owner", country: "Ukraine" };
    const admin = { uid: "admin-1", role: "admin" };

    beforeEach(() => {
        getFirestoreInstanceMock.mockReset();
        assertUserWritableInTxMock.mockClear();
        assertUserWritableMock.mockClear();
        recordMock.mockClear();

        state = {
            users: {
                [owner.uid]: { uid: owner.uid, role: owner.role, country: owner.country, isDeleted: false },
                [admin.uid]: { uid: admin.uid, role: admin.role, isDeleted: false },
            },
            showrooms: [
                makeDraftShowroom("sr-a", owner.uid, "Alpha", "Addr 1"),
                makeDraftShowroom("sr-b", owner.uid, "Bravo", "Addr 2"),
                makeDraftShowroom("sr-c", owner.uid, "Charlie", "Addr 3"),
            ],
        };
        getFirestoreInstanceMock.mockReturnValue(makeDb(state));
    });

    it("basic queue: submits items, orders by submittedAt desc, returns nextCursor and DTO whitelist", async () => {
        await submitShowroomForReviewService("sr-a", owner);
        await submitShowroomForReviewService("sr-b", owner);
        await submitShowroomForReviewService("sr-c", owner);

        const result = await listAdminModerationQueueService({ status: "pending", limit: 2 }, admin);

        expect(result.showrooms).toHaveLength(2);
        expect(result.showrooms.map(s => s.id)).toEqual(["sr-c", "sr-b"]);
        expect(result.meta.hasMore).toBe(true);
        expect(typeof result.meta.nextCursor).toBe("string");

        result.showrooms.forEach(item => {
            expect(item.submittedAt).toBeTruthy();
            expect(item).toHaveProperty("id");
            expect(item).toHaveProperty("ownerUid");
            expect(item).toHaveProperty("submittedAt");

            expect(item).not.toHaveProperty("editHistory");
            expect(item).not.toHaveProperty("pendingSnapshot");
            expect(item).not.toHaveProperty("brandsMap");
            expect(item).not.toHaveProperty("nameNormalized");
            expect(item).not.toHaveProperty("addressNormalized");
        });

        const pendingDocs = state.showrooms.filter(s => s.status === "pending");
        expect(pendingDocs).toHaveLength(3);
        pendingDocs.forEach(doc => {
            expect(typeof doc.submittedAt).toBe("string");
            expect(doc.submittedAt).toMatch(/T/);
        });
    });

    it("cursor pagination: no duplicates and last page hasMore=false", async () => {
        await submitShowroomForReviewService("sr-a", owner);
        await submitShowroomForReviewService("sr-b", owner);
        await submitShowroomForReviewService("sr-c", owner);

        const page1 = await listAdminModerationQueueService({ status: "pending", limit: 2 }, admin);
        const page2 = await listAdminModerationQueueService(
            { status: "pending", limit: 2, cursor: page1.meta.nextCursor },
            admin
        );

        expect(page1.showrooms.map(s => s.id)).toEqual(["sr-c", "sr-b"]);
        expect(page2.showrooms.map(s => s.id)).toEqual(["sr-a"]);
        expect(new Set([...page1.showrooms, ...page2.showrooms].map(s => s.id)).size).toBe(3);
        expect(page2.meta.hasMore).toBe(false);
        expect(page2.meta.paging).toBe("end");
        expect(page2.meta.nextCursor).toBeNull();
    });

    it("cursor mismatch at endpoint level: missing status => QUERY_INVALID, different status => CURSOR_INVALID", async () => {
        const cursor = encodeAdminModerationCursor({
            status: "pending",
            lastValue: "2026-02-25T12:00:00.000Z",
            id: "sr-z",
        });

        const next1 = jest.fn();
        await listShowroomsAdmin(
            { query: { cursor }, user: admin },
            makeRes(),
            next1
        );
        expect(next1).toHaveBeenCalledWith(expect.objectContaining({ code: "QUERY_INVALID" }));

        const next2 = jest.fn();
        await listShowroomsAdmin(
            { query: { status: "approved", cursor }, user: admin },
            makeRes(),
            next2
        );
        expect(next2).toHaveBeenCalledWith(expect.objectContaining({ code: "CURSOR_INVALID" }));
    });

    it("deterministic order uses __name__ asc tie-breaker when submittedAt is equal", async () => {
        state.showrooms = [
            {
                ...makeDraftShowroom("sr-b", owner.uid, "B", "Addr B"),
                status: "pending",
                submittedAt: "2026-02-25T12:00:00.000Z",
            },
            {
                ...makeDraftShowroom("sr-a", owner.uid, "A", "Addr A"),
                status: "pending",
                submittedAt: "2026-02-25T12:00:00.000Z",
            },
            {
                ...makeDraftShowroom("sr-c", owner.uid, "C", "Addr C"),
                status: "pending",
                submittedAt: "2026-02-25T11:00:00.000Z",
            },
        ];

        const result = await listAdminModerationQueueService({ status: "pending", limit: 10 }, admin);
        expect(result.showrooms.map(s => s.id)).toEqual(["sr-a", "sr-b", "sr-c"]);
    });

    it("validates limit parity: default=20, max=100, invalid => QUERY_INVALID", async () => {
        state.showrooms = Array.from({ length: 25 }, (_, i) => ({
            ...makeDraftShowroom(`sr-${String(i).padStart(2, "0")}`, owner.uid, `Name ${i}`, `Addr ${i}`),
            status: "pending",
            submittedAt: new Date(Date.parse("2026-02-25T00:00:00.000Z") + i * 1000).toISOString(),
        }));

        const defaultPage = await listAdminModerationQueueService({ status: "pending" }, admin);
        expect(defaultPage.showrooms).toHaveLength(20);

        await expect(
            listAdminModerationQueueService({ status: "pending", limit: 101 }, admin)
        ).rejects.toMatchObject({ code: "QUERY_INVALID" });

        await expect(
            listAdminModerationQueueService({ status: "pending", limit: "abc" }, admin)
        ).rejects.toMatchObject({ code: "QUERY_INVALID" });
    });
});
