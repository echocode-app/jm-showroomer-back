import { Timestamp } from "firebase-admin/firestore";
import {
    ADMIN_MODERATION_CURSOR,
    assertAdminModerationCursorFingerprint,
    decodeAdminModerationCursor,
    encodeAdminModerationCursor,
    mapShowroomToAdminModerationQueueDTO,
    parseAdminModerationQueueQuery,
    parseAdminShowroomsStatus,
} from "../adminModerationQueue.js";

describe("admin moderation queue status parsing", () => {
    it("requires explicit status for admin list", () => {
        expect(() => parseAdminShowroomsStatus({})).toThrow(
            expect.objectContaining({ code: "QUERY_INVALID" })
        );
    });

    it("validates status enum", () => {
        expect(() =>
            parseAdminShowroomsStatus({ status: "anything" })
        ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
        expect(parseAdminShowroomsStatus({ status: "PENDING" })).toBe("pending");
    });
});

describe("admin moderation queue parser", () => {
    it("accepts only status/limit/cursor and enforces pending", () => {
        const parsed = parseAdminModerationQueueQuery({ status: "pending", limit: "5" });
        expect(parsed).toEqual(expect.objectContaining({ status: "pending", limit: 5 }));

        expect(() =>
            parseAdminModerationQueueQuery({ status: "pending", q: "abc" })
        ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));

        expect(() =>
            parseAdminModerationQueueQuery({ status: "approved" })
        ).toThrow(expect.objectContaining({ code: "QUERY_INVALID" }));
    });
});

describe("admin moderation cursor v3", () => {
    it("encodes/decodes moderation cursor fingerprint", () => {
        const encoded = encodeAdminModerationCursor({
            status: "pending",
            lastValue: "2026-01-01T00:00:00.000Z",
            id: "sr1",
        });
        const decoded = decodeAdminModerationCursor(encoded);

        expect(decoded).toEqual({
            v: 3,
            mode: "moderation",
            status: "pending",
            orderField: "submittedAt",
            direction: "desc",
            lastValue: "2026-01-01T00:00:00.000Z",
            id: "sr1",
        });
        expect(decoded.v).toBe(ADMIN_MODERATION_CURSOR.version);
    });

    it("serializes timestamp-like cursor values", () => {
        const encoded = encodeAdminModerationCursor({
            lastValue: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z")),
            id: "sr1",
        });
        const decoded = decodeAdminModerationCursor(encoded);
        expect(decoded.lastValue).toBeInstanceOf(Timestamp);
    });

    it("rejects cursor fingerprint mismatch", () => {
        const bad = Buffer.from(
            JSON.stringify({
                v: 3,
                mode: "public",
                status: "pending",
                orderField: "submittedAt",
                direction: "desc",
                lastValue: "2026-01-01T00:00:00.000Z",
                id: "sr1",
            })
        ).toString("base64");
        const decoded = decodeAdminModerationCursor(bad);
        expect(() =>
            assertAdminModerationCursorFingerprint(decoded, { status: "pending" })
        ).toThrow(expect.objectContaining({ code: "CURSOR_INVALID" }));
    });
});

describe("admin moderation queue dto", () => {
    it("returns admin queue whitelist without internal/derived fields", () => {
        const dto = mapShowroomToAdminModerationQueueDTO({
            id: "sr1",
            name: "Name",
            type: "unique",
            country: "UA",
            city: "Kyiv",
            ownerUid: "owner-1",
            submittedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            editCount: 3,
            status: "pending",
            nameNormalized: "name",
            brandsMap: { zara: true },
            pendingSnapshot: { name: "Name" },
            editHistory: [{ action: "submit" }],
        });

        expect(dto).toEqual({
            id: "sr1",
            name: "Name",
            type: "unique",
            country: "UA",
            city: "Kyiv",
            ownerUid: "owner-1",
            submittedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            editCount: 3,
            status: "pending",
        });
        expect(dto).not.toHaveProperty("nameNormalized");
        expect(dto).not.toHaveProperty("brandsMap");
        expect(dto).not.toHaveProperty("pendingSnapshot");
        expect(dto).not.toHaveProperty("editHistory");
    });
});
