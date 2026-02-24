const MAX_PAYLOAD_DEPTH = 2;
const MAX_EVENT_CLIENT_PAYLOAD_BYTES = 4 * 1024;
const MAX_ARRAY_LENGTH = 20;

const BLOCKED_KEYS = new Set([
    "email",
    "phone",
    "password",
    "token",
    "idtoken",
    "authorization",
    "cookie",
    "fcmtoken",
    "refreshtoken",
]);

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeValue(value, depth) {
    if (value == null) return value;

    if (Array.isArray(value)) {
        if (depth > MAX_PAYLOAD_DEPTH) {
            return [{ truncated: true }];
        }
        return value
            .slice(0, MAX_ARRAY_LENGTH)
            .map(item => sanitizeValue(item, depth + 1))
            .filter(item => item !== undefined);
    }

    if (typeof value !== "object") {
        return value;
    }

    if (!isPlainObject(value)) {
        return String(value);
    }

    if (depth > MAX_PAYLOAD_DEPTH) {
        return { truncated: true };
    }

    const out = {};
    for (const [key, nested] of Object.entries(value)) {
        if (BLOCKED_KEYS.has(String(key).toLowerCase())) continue;
        const sanitized = sanitizeValue(nested, depth + 1);
        if (sanitized !== undefined) {
            out[key] = sanitized;
        }
    }
    return out;
}

export function sanitizeAnalyticsClientObject(input) {
    if (!isPlainObject(input)) return {};
    const sanitized = sanitizeValue(input, 0);
    return isPlainObject(sanitized) ? sanitized : {};
}

export function applyAnalyticsEventPayloadBudget({
    context = {},
    meta = {},
    resourceAttributes = {},
}) {
    let next = { context, meta, resourceAttributes };

    if (serializedSize(next) <= MAX_EVENT_CLIENT_PAYLOAD_BYTES) {
        return next;
    }

    next = { ...next, meta: { truncated: true } };
    if (serializedSize(next) <= MAX_EVENT_CLIENT_PAYLOAD_BYTES) {
        return next;
    }

    next = {
        context: { truncated: true },
        meta: { truncated: true },
        resourceAttributes: { truncated: true },
    };
    return next;
}

function serializedSize(value) {
    try {
        return JSON.stringify(value).length;
    } catch {
        return Number.POSITIVE_INFINITY;
    }
}
