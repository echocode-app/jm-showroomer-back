import { randomUUID } from "node:crypto";
import { badRequest } from "../core/error.js";

const MAX_ANON_ID_LENGTH = 128;
const ANON_ID_RE = /^[A-Za-z0-9_-]+$/;

function parseAnonymousId(raw) {
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    if (!value) return null;
    if (value.length > MAX_ANON_ID_LENGTH || !ANON_ID_RE.test(value)) {
        throw badRequest("ANON_ID_INVALID");
    }
    return value;
}

// Resolves request actor for both authenticated and guest flows.
// Authenticated users use uid as the actor key; guests use x-anonymous-id.
export function resolveActorIdentity(req) {
    const headerValue = Array.isArray(req.headers["x-anonymous-id"])
        ? req.headers["x-anonymous-id"][0]
        : req.headers["x-anonymous-id"];
    const parsedAnonymousId = parseAnonymousId(headerValue);

    const uid = req.auth?.uid ?? null;
    if (uid) {
        if (parsedAnonymousId) {
            // Keep anon continuity for guest-created resources after login.
            req._anonymousIdForResponse = parsedAnonymousId;
        }
        return {
            actorKey: `u:${uid}`,
            likeWriteKey: `u:${uid}`,
            likeReadKeys: dedupeKeys([
                `u:${uid}`,
                uid, // legacy auth key compatibility
                parsedAnonymousId ? `a:${parsedAnonymousId}` : null,
                parsedAnonymousId ? `anon:${parsedAnonymousId}` : null, // legacy anon key compatibility
            ]),
            userId: uid,
            anonymousId: parsedAnonymousId,
            isAnonymous: false,
            generatedAnonymousId: false,
        };
    }

    const anonymousId = parsedAnonymousId ?? randomUUID();
    req._anonymousIdForResponse = anonymousId;

    return {
        actorKey: `a:${anonymousId}`,
        likeWriteKey: `a:${anonymousId}`,
        likeReadKeys: dedupeKeys([
            `a:${anonymousId}`,
            `anon:${anonymousId}`, // legacy anon key compatibility
        ]),
        userId: null,
        anonymousId,
        isAnonymous: true,
        generatedAnonymousId: !parsedAnonymousId,
    };
}

export function attachAnonymousIdHeader(res, actor) {
    if (!actor?.anonymousId) return;
    res.set("x-anonymous-id", actor.anonymousId);
}

function dedupeKeys(keys) {
    return Array.from(new Set(keys.filter(Boolean)));
}
