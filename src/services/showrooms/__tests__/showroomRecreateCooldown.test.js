import { jest } from "@jest/globals";

const DEV_STORE = { showrooms: [] };
let idCounter = 1;

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: jest.fn(),
}));

jest.unstable_mockModule("../../../config/logger.js", () => ({
    log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.unstable_mockModule("../_store.js", () => ({
    DEV_STORE,
    useDevMock: true,
    generateId: jest.fn(() => `sr-${idCounter++}`),
}));

jest.unstable_mockModule("../../analytics/analyticsEventBuilder.js", () => ({
    buildAnalyticsEvent: jest.fn(payload => payload),
}));

jest.unstable_mockModule("../../analytics/analyticsEventService.js", () => ({
    record: jest.fn(async () => {}),
}));

jest.unstable_mockModule("../../analytics/eventNames.js", () => ({
    ANALYTICS_EVENTS: {
        SHOWROOM_CREATE_STARTED: "showroom_create_started",
        SHOWROOM_SUBMIT_FOR_REVIEW: "showroom_submit_for_review",
    },
}));

const { createShowroom } = await import("../createShowroom.js");
const { submitShowroomForReviewService } = await import("../submitShowroomForReview.js");
const { deleteShowroomService } = await import("../deleteShowroom.js");
const { addMonths } = await import("../../../utils/date.js");

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeCreatePayload(overrides = {}) {
    return {
        name: "Atelier Nova",
        type: "unique",
        country: "Ukraine",
        availability: "offline",
        category: "fashion",
        categoryGroup: "clothing",
        subcategories: ["dresses"],
        brands: ["Brand A"],
        address: "Khreshchatyk 1",
        city: "Kyiv",
        contacts: {
            phone: "+380671234567",
            instagram: "instagram.com/ateliernova",
        },
        location: { lat: 50.45, lng: 30.52 },
        geo: {
            city: "Kyiv",
            country: "Ukraine",
            coords: { lat: 50.45, lng: 30.52 },
        },
        ...overrides,
    };
}

function makeDraftShowroom(id, ownerUid, name, overrides = {}) {
    return {
        id,
        ownerUid,
        status: "draft",
        name,
        nameNormalized: name.toLowerCase(),
        type: "unique",
        country: "Ukraine",
        city: "Kyiv",
        address: "Addr 1",
        addressNormalized: "addr 1",
        availability: "offline",
        contacts: {
            phone: "+380671234567",
            instagram: "https://instagram.com/example",
        },
        location: { lat: 50.45, lng: 30.52 },
        geo: {
            city: "Kyiv",
            cityNormalized: "kyiv",
            country: "Ukraine",
            coords: { lat: 50.45, lng: 30.52 },
            geohash: "u8c",
        },
        brands: ["Brand A"],
        createdAt: "2026-02-01T10:00:00.000Z",
        updatedAt: "2026-02-01T10:00:00.000Z",
        editCount: 0,
        editHistory: [],
        ...overrides,
    };
}

describe("showroom recreate cooldown (3 months after soft delete)", () => {
    const owner = { uid: "owner-1", role: "owner", country: "Ukraine" };
    const otherOwner = { uid: "owner-2", role: "owner", country: "Ukraine" };

    beforeEach(() => {
        DEV_STORE.showrooms.length = 0;
        idCounter = 1;
        jest.clearAllMocks();
    });

    it("owner deletes showroom and immediate recreate is blocked", async () => {
        const payload = makeCreatePayload();
        const created = await createShowroom(payload, owner.uid, { userCountry: owner.country });

        await deleteShowroomService(created.id, owner);

        await expect(
            createShowroom(payload, owner.uid, { userCountry: owner.country })
        ).rejects.toMatchObject({
            code: "SHOWROOM_RECREATE_COOLDOWN",
        });
    });

    it("recreate after simulated 3 months is allowed", async () => {
        const payload = makeCreatePayload();
        const created = await createShowroom(payload, owner.uid, { userCountry: owner.country });
        await deleteShowroomService(created.id, owner);

        const deleted = DEV_STORE.showrooms.find(s => s.id === created.id);
        const fourMonthsAgo = new Date();
        fourMonthsAgo.setUTCMonth(fourMonthsAgo.getUTCMonth() - 4);
        deleted.deletedAt = fourMonthsAgo.toISOString();

        await expect(
            createShowroom(payload, owner.uid, { userCountry: owner.country })
        ).resolves.toMatchObject({
            ownerUid: owner.uid,
            status: "draft",
            name: payload.name,
        });
    });

    it("different owner is allowed to create same showroom name during cooldown", async () => {
        const payload = makeCreatePayload();
        const created = await createShowroom(payload, owner.uid, { userCountry: owner.country });
        await deleteShowroomService(created.id, owner);

        await expect(
            createShowroom(payload, otherOwner.uid, { userCountry: otherOwner.country })
        ).resolves.toMatchObject({
            ownerUid: otherOwner.uid,
            status: "draft",
        });
    });

    it("different showroom name is allowed during cooldown", async () => {
        const created = await createShowroom(makeCreatePayload(), owner.uid, {
            userCountry: owner.country,
        });
        await deleteShowroomService(created.id, owner);

        await expect(
            createShowroom(
                makeCreatePayload({ name: "Atelier Nova 2" }),
                owner.uid,
                { userCountry: owner.country }
            )
        ).resolves.toMatchObject({
            ownerUid: owner.uid,
            status: "draft",
            name: "Atelier Nova 2",
        });
    });

    it("submit is blocked by cooldown when same owner has recent soft-deleted showroom with same normalized name", async () => {
        const recentDeletedAt = new Date().toISOString();
        DEV_STORE.showrooms.push(
            makeDraftShowroom("sr-deleted", owner.uid, "Atelier Nova", {
                status: "deleted",
                deletedAt: recentDeletedAt,
                deletedBy: { uid: owner.uid, role: owner.role },
            }),
            makeDraftShowroom("sr-current", owner.uid, "Atelier Nova", {
                nameNormalized: undefined,
                addressNormalized: undefined,
            })
        );

        await expect(
            submitShowroomForReviewService("sr-current", owner)
        ).rejects.toMatchObject({
            code: "SHOWROOM_RECREATE_COOLDOWN",
        });
    });

    it("submit is allowed after cooldown expires", async () => {
        const oldDeletedAt = addMonths(new Date(), -4).toISOString();
        DEV_STORE.showrooms.push(
            makeDraftShowroom("sr-deleted", owner.uid, "Atelier Nova", {
                status: "deleted",
                deletedAt: oldDeletedAt,
                deletedBy: { uid: owner.uid, role: owner.role },
            }),
            makeDraftShowroom("sr-current", owner.uid, "Atelier Nova", {
                nameNormalized: undefined,
                addressNormalized: undefined,
            })
        );

        await expect(
            submitShowroomForReviewService("sr-current", owner)
        ).resolves.toMatchObject({
            id: "sr-current",
            status: "pending",
        });
    });

    it("pending showroom delete still blocked as before", async () => {
        DEV_STORE.showrooms.push(
            makeDraftShowroom("sr-pending", owner.uid, "Pending One", {
                status: "pending",
            })
        );

        await expect(deleteShowroomService("sr-pending", owner)).rejects.toMatchObject({
            code: "SHOWROOM_LOCKED_PENDING",
        });
    });

    it("cooldown stores nextAvailableAt metadata on error (optional)", async () => {
        const payload = makeCreatePayload();
        const created = await createShowroom(payload, owner.uid, { userCountry: owner.country });
        await deleteShowroomService(created.id, owner);

        try {
            await createShowroom(payload, owner.uid, { userCountry: owner.country });
            throw new Error("Expected cooldown error");
        } catch (err) {
            expect(err.code).toBe("SHOWROOM_RECREATE_COOLDOWN");
            expect(err.meta?.nextAvailableAt).toEqual(expect.any(String));
            const nextDate = new Date(err.meta.nextAvailableAt);
            expect(Number.isFinite(nextDate.getTime())).toBe(true);
        }
    });

    it("does not mutate unrelated deleted records during cooldown checks", async () => {
        DEV_STORE.showrooms.push(
            makeDraftShowroom("sr-del", owner.uid, "Atelier Nova", {
                status: "deleted",
                deletedAt: new Date().toISOString(),
            })
        );
        const before = clone(DEV_STORE.showrooms);

        await expect(
            createShowroom(makeCreatePayload(), owner.uid, { userCountry: owner.country })
        ).rejects.toMatchObject({
            code: "SHOWROOM_RECREATE_COOLDOWN",
        });

        expect(DEV_STORE.showrooms).toEqual(before);
    });
});
