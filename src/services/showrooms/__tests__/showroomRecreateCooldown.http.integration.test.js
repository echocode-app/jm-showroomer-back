import express from "express";
import { jest } from "@jest/globals";

const DEV_STORE = { showrooms: [] };
let idCounter = 1;

const getFirestoreInstanceMock = jest.fn();
const getAuthInstanceMock = jest.fn();

jest.unstable_mockModule("../../../config/firebase.js", () => ({
    getFirestoreInstance: getFirestoreInstanceMock,
    getAuthInstance: getAuthInstanceMock,
    getMessagingInstance: jest.fn(),
    getStorageInstance: jest.fn(),
    initFirebase: jest.fn(),
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
    recordBatch: jest.fn(async () => ({ accepted: 0, stored: 0, failed: 0 })),
}));

jest.unstable_mockModule("../../analytics/eventNames.js", () => ({
    ANALYTICS_EVENTS: {
        SHOWROOM_CREATE_STARTED: "showroom_create_started",
        SHOWROOM_SUBMIT_FOR_REVIEW: "showroom_submit_for_review",
        SHOWROOM_VIEW: "showroom_view",
        SHOWROOM_FAVORITE: "showroom_favorite",
        SHOWROOM_UNFAVORITE: "showroom_unfavorite",
        AUTH_COMPLETED: "auth_completed",
        AUTH_FAILED: "auth_failed",
        LOOKBOOK_VIEW: "lookbook_view",
        LOOKBOOK_FAVORITE: "lookbook_favorite",
        LOOKBOOK_UNFAVORITE: "lookbook_unfavorite",
        EVENT_VIEW: "event_view",
        EVENT_WANT_TO_VISIT: "event_want_to_visit",
        EVENT_REMOVE_WANT_TO_VISIT: "event_remove_want_to_visit",
    },
}));

const { default: showroomsRouter } = await import("../../../routes/showrooms.js");
const { errorHandler } = await import("../../../middlewares/error.js");

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeUserDb(usersById) {
    return {
        collection(name) {
            if (name !== "users") {
                throw new Error(`Unexpected collection read in test: ${name}`);
            }
            return {
                doc(id) {
                    return {
                        async get() {
                            const user = usersById[id];
                            return {
                                exists: Boolean(user),
                                data: () => clone(user),
                            };
                        },
                    };
                },
            };
        },
    };
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

async function withServer(handler) {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/showrooms", showroomsRouter);
    app.use(errorHandler);

    const server = await new Promise(resolve => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });

    try {
        const { port } = server.address();
        await handler(`http://127.0.0.1:${port}/api/v1/showrooms`);
    } finally {
        await new Promise((resolve, reject) => {
            server.close(err => (err ? reject(err) : resolve()));
        });
    }
}

describe("showroom recreate cooldown HTTP integration", () => {
    const ownerUid = "owner-http-1";
    const authMock = {
        verifyIdToken: jest.fn(async token => {
            if (token !== "owner-token") throw new Error("invalid token");
            return { uid: ownerUid };
        }),
    };

    beforeEach(() => {
        DEV_STORE.showrooms.length = 0;
        idCounter = 1;
        jest.clearAllMocks();

        getAuthInstanceMock.mockReturnValue(authMock);
        getFirestoreInstanceMock.mockReturnValue(
            makeUserDb({
                [ownerUid]: {
                    uid: ownerUid,
                    role: "owner",
                    roles: ["owner"],
                    country: "Ukraine",
                    isDeleted: false,
                    deleteLock: null,
                },
            })
        );
    });

    it("blocks immediate recreate after soft delete with HTTP 409 and cooldown code", async () => {
        const payload = makeCreatePayload();

        await withServer(async baseUrl => {
            const headers = {
                "content-type": "application/json",
                authorization: "Bearer owner-token",
            };

            const createRes = await fetch(`${baseUrl}/create`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });
            expect(createRes.status).toBe(200);
            const createBody = await createRes.json();
            expect(createBody.success).toBe(true);
            const showroomId = createBody?.data?.showroom?.id;
            expect(typeof showroomId).toBe("string");

            const deleteRes = await fetch(`${baseUrl}/${showroomId}`, {
                method: "DELETE",
                headers: {
                    authorization: "Bearer owner-token",
                },
            });
            expect(deleteRes.status).toBe(200);

            const recreateRes = await fetch(`${baseUrl}/create`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });
            expect(recreateRes.status).toBe(409);
            const recreateBody = await recreateRes.json();
            expect(recreateBody).toMatchObject({
                error: {
                    code: "SHOWROOM_RECREATE_COOLDOWN",
                },
            });
            expect(recreateBody.error.meta?.nextAvailableAt).toEqual(expect.any(String));
        });
    });
});
