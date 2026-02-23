import { log as baseLogger } from "../config/logger.js";

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

  const payload = compactObject({
    requestId: req?.id,
    actorId: deriveActorId(req),
    domain,
    event,
    resourceType,
    resourceId,
    status,
    meta: isPlainObject(meta) ? meta : undefined,
  });

  targetLogger[logLevel](payload);
}

logDomainEvent.info = (req, eventData) => logDomainEvent(req, eventData, "info");
logDomainEvent.warn = (req, eventData) => logDomainEvent(req, eventData, "warn");
logDomainEvent.error = (req, eventData) => logDomainEvent(req, eventData, "error");

