// Validates client analytics ingest payloads and enforces event-name whitelist.
// Drift protection: eventName must be snake_case and present in ANALYTICS_EVENTS.
import { badRequest } from "../../core/error.js";
import { log as baseLogger } from "../../config/logger.js";
import { ANALYTICS_EVENTS } from "./eventNames.js";

const EVENT_NAME_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MAX_EVENT_NAME_LENGTH = 64;
const ALLOWED_EVENTS = new Set(Object.values(ANALYTICS_EVENTS));

export function validateAnalyticsIngestPayload(payload, options = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw badRequest("QUERY_INVALID");
    }

    const events = payload.events;
    if (!Array.isArray(events)) {
        throw badRequest("QUERY_INVALID");
    }
    if (events.length === 0 || events.length > 50) {
        throw badRequest("QUERY_INVALID");
    }

    events.forEach(event => validateAnalyticsClientEvent(event, options));
    return { events };
}

export function validateAnalyticsClientEvent(event, options = {}) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
        throw badRequest("QUERY_INVALID");
    }

    const eventName = validateEventName(event.eventName);
    assertOptionalObject(event.context);
    assertOptionalObject(event.resource);
    assertOptionalObject(event.meta);
    warnOnSoftShapeMismatch(eventName, event, options?.logger ?? baseLogger);

    return event;
}

export function validateEventName(eventName) {
    if (typeof eventName !== "string") {
        throw badRequest("QUERY_INVALID");
    }

    const normalized = eventName.trim();
    if (
        !normalized ||
        normalized.length > MAX_EVENT_NAME_LENGTH ||
        !EVENT_NAME_RE.test(normalized)
    ) {
        throw badRequest("QUERY_INVALID");
    }
    if (!ALLOWED_EVENTS.has(normalized)) {
        throw badRequest("EVENT_NAME_INVALID");
    }

    return normalized;
}

function assertOptionalObject(value) {
    if (value === undefined) return;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw badRequest("QUERY_INVALID");
    }
}

function warnOnSoftShapeMismatch(eventName, event, logger) {
    if (!requiresResourceIdentity(eventName)) return;

    const missingFields = [];
    const resource = event?.resource;
    if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
        missingFields.push("resource.type", "resource.id");
    } else {
        if (!isNonEmptyString(resource.type)) missingFields.push("resource.type");
        if (!isNonEmptyString(resource.id)) missingFields.push("resource.id");
    }

    if (missingFields.length === 0) return;
    if (!logger || typeof logger.warn !== "function") return;

    logger.warn(
        {
            analyticsValidation: {
                code: "analytics_invalid_shape",
                eventName,
                missingFields,
            },
        },
        "analytics ingest shape warning"
    );
}

function requiresResourceIdentity(eventName) {
    return /(?:_view|_favorite|_want_to_visit)$/.test(eventName);
}

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
}
