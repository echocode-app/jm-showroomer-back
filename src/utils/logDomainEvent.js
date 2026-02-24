import { log as baseLogger } from "../config/logger.js";

const META_MAX_BYTES = 1024;
const META_MAX_DEPTH = 2;
const REDACTED_META_KEYS = new Set([
  "email",
  "phone",
  "token",
  "idtoken",
  "authorization",
  "cookie",
  "fcmtoken",
]);

function getHeaderValue(headers, name) {
  const value = headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function deriveActorId(req) {
  if (typeof req?._logActorId === "string" && req._logActorId) return req._logActorId;
  if (req?.auth?.uid) return `u:${req.auth.uid}`;

  const anonymousId = getHeaderValue(req?.headers, "x-anonymous-id").trim();
  if (anonymousId) return `a:${anonymousId}`;

  return undefined;
}

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function getInvalidSchemaFields(payload) {
  const invalidFields = [];
  if (!isNonEmptyString(payload?.domain)) invalidFields.push("domain");
  if (!isNonEmptyString(payload?.event)) invalidFields.push("event");
  return invalidFields;
}

function sanitizeMetaValue(value, depth) {
  if (value == null) return value;
  if (Array.isArray(value)) return undefined;
  if (typeof value !== "object") return value;
  if (!isPlainObject(value)) return String(value);

  if (depth >= META_MAX_DEPTH) {
    return { truncated: true };
  }

  const sanitized = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (REDACTED_META_KEYS.has(key.toLowerCase())) continue;
    const nextValue = sanitizeMetaValue(nestedValue, depth + 1);
    if (nextValue !== undefined) {
      sanitized[key] = nextValue;
    }
  }
  return sanitized;
}

export function sanitizeMeta(meta) {
  if (!isPlainObject(meta)) return undefined;

  const sanitized = sanitizeMetaValue(meta, 0);
  if (!isPlainObject(sanitized)) return undefined;

  try {
    if (JSON.stringify(sanitized).length > META_MAX_BYTES) {
      return { truncated: true };
    }
  } catch {
    return { truncated: true };
  }

  return sanitized;
}

function logInvalidSchema(targetLogger, req, eventData, invalidFields) {
  targetLogger.error(
    compactObject({
      requestId: req?.id,
      actorId: deriveActorId(req),
      domain: "invalid_schema",
      event: "invalid_domain_log",
      status: "failed",
      meta: {
        originalPayloadPresent: !!eventData,
        invalidFields,
      },
    })
  );
}

export function logDomainEvent(req, eventData, level = "info") {
  const targetLogger = req?.log || baseLogger;
  const logLevel =
    typeof targetLogger?.[level] === "function" ? level : "info";

  const {
    domain,
    event,
    resourceType,
    resourceId,
    status,
    meta,
  } = eventData || {};

  const invalidFields = getInvalidSchemaFields({ domain, event });
  if (invalidFields.length > 0) {
    if (process.env.NODE_ENV === "dev") {
      throw new Error("Invalid domain log schema");
    }
    logInvalidSchema(targetLogger, req, eventData, invalidFields);
    return;
  }

  const payload = compactObject({
    requestId: req?.id,
    actorId: deriveActorId(req),
    domain,
    event,
    resourceType,
    resourceId,
    status,
    meta: sanitizeMeta(meta),
  });

  targetLogger[logLevel](payload);
}

logDomainEvent.info = (req, eventData) => logDomainEvent(req, eventData, "info");
logDomainEvent.warn = (req, eventData) => logDomainEvent(req, eventData, "warn");
logDomainEvent.error = (req, eventData) => logDomainEvent(req, eventData, "error");
