import { randomUUID } from "node:crypto";
import { validateEventName } from "./analyticsValidator.js";

export function buildAnalyticsEvent({
    eventName,
    source,
    actor = null,
    context = {},
    resource = {},
    meta = {},
}) {
    const nowIso = new Date().toISOString();
    const normalizedSource = source === "server" ? "server" : "client";
    const normalizedEventName = validateEventName(eventName);
    const actorFields = normalizeActor(actor);
    const normalizedContext = normalizeObject(context);
    const normalizedMeta = normalizeObject(meta);
    const normalizedResource = normalizeResource(resource);

    const sessionId = normalizeString(normalizedContext.sessionId)
        ?? normalizeString(normalizedMeta.sessionId);
    if (sessionId) {
        normalizedContext.sessionId = sessionId;
    }

    const normalizedSurface = normalizeString(normalizedContext.surface) || "unknown";
    const producer = normalizeString(normalizedMeta.producer)
        || (normalizedSource === "server" ? "backend_api" : "mobile_app");
    delete normalizedMeta.sessionId;

    return {
        eventId: randomUUID(),
        eventName: normalizedEventName,
        schemaVersion: 1,
        eventVersion: 1,
        timestamp: nowIso,
        user: {
            actorId: actorFields.actorId,
            userId: actorFields.userId,
            anonymousId: actorFields.anonymousId,
            isAuthenticated: actorFields.isAuthenticated,
            accountState: actorFields.accountState,
            linkedAnonymousId: actorFields.linkedAnonymousId,
        },
        context: {
            ...normalizedContext,
            surface: normalizedSurface,
            source: normalizedSource,
        },
        resource: normalizedResource,
        meta: {
            ...normalizedMeta,
            producer,
            sampleRate: normalizeSampleRate(normalizedMeta.sampleRate),
            ingestedAt: nowIso,
        },
    };
}

function normalizeActor(actor) {
    const userId = normalizeString(actor?.userId);
    const anonymousId = normalizeString(actor?.anonymousId);
    const linkedAnonymousId = normalizeString(actor?.anonymousId);
    const isAuthenticated = Boolean(userId) && actor?.isAnonymous !== true;
    const actorId = userId ? `u:${userId}` : `a:${anonymousId || "unknown"}`;

    return {
        actorId,
        userId: userId || null,
        anonymousId: anonymousId || null,
        isAuthenticated,
        accountState: normalizeAccountState(actor?.accountState),
        linkedAnonymousId: isAuthenticated ? (linkedAnonymousId || null) : null,
    };
}

function normalizeResource(resource) {
    const obj = normalizeObject(resource);
    const attributes = normalizeObject(obj.attributes);

    return {
        type: normalizeString(obj.type) || "unknown",
        id: normalizeString(obj.id) || null,
        parentType: normalizeString(obj.parentType) || null,
        parentId: normalizeString(obj.parentId) || null,
        ownerUserId: normalizeString(obj.ownerUserId) || null,
        attributes,
    };
}

function normalizeObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return { ...value };
}

function normalizeString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeAccountState(value) {
    const normalized = normalizeString(value);
    if (!normalized) return "unknown";
    return normalized;
}

function normalizeSampleRate(value) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
    }
    return 1;
}
