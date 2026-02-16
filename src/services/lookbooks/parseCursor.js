import { Timestamp } from "firebase-admin/firestore";
import { badRequest } from "../../core/error.js";

export const CURSOR_VERSION = 1;

export function encodeListCursor(cursor) {
    if (!cursor) return null;
    if (cursor.mode === "rank") {
        return Buffer.from(
            JSON.stringify({
                v: CURSOR_VERSION,
                m: "rank",
                r: cursor.sortRank,
                id: cursor.id,
            })
        ).toString("base64");
    }

    return Buffer.from(
        JSON.stringify({
            v: CURSOR_VERSION,
            m: "published",
            p: cursor.publishedAtIso,
            id: cursor.id,
        })
    ).toString("base64");
}

export function decodeListCursor(encoded) {
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        if (!parsed || parsed.v !== CURSOR_VERSION || typeof parsed.id !== "string" || !parsed.id) {
            throw badRequest("CURSOR_INVALID");
        }

        if (parsed.m === "rank") {
            if (!Number.isFinite(parsed.r)) {
                throw badRequest("CURSOR_INVALID");
            }

            return {
                mode: "rank",
                sortRank: Number(parsed.r),
                id: parsed.id,
            };
        }

        if (parsed.m === "published") {
            if (typeof parsed.p !== "string" || !parsed.p) {
                throw badRequest("CURSOR_INVALID");
            }

            const ms = Date.parse(parsed.p);
            if (!Number.isFinite(ms)) {
                throw badRequest("CURSOR_INVALID");
            }

            const iso = new Date(ms).toISOString();
            return {
                mode: "published",
                publishedAtIso: iso,
                publishedAtTs: Timestamp.fromDate(new Date(ms)),
                id: parsed.id,
            };
        }

        throw badRequest("CURSOR_INVALID");
    } catch {
        throw badRequest("CURSOR_INVALID");
    }
}
