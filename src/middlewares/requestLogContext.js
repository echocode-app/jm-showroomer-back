// Request log context helpers: attach actorId without touching auth/user business state.
import { log } from "../config/logger.js";

function getHeaderValue(headers, name) {
  const value = headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function deriveActorId(req) {
  if (req?.auth?.uid) return `u:${req.auth.uid}`;

  const anonymousId = getHeaderValue(req?.headers, "x-anonymous-id").trim();
  if (anonymousId) return `a:${anonymousId}`;

  return undefined;
}

export function attachActorLogContext(req) {
  if (!req?.log) return;
  if (!req._baseLog) {
    req._baseLog = req.log;
  }

  const actorId = deriveActorId(req);
  if (!actorId) return;
  if (req._logActorId === actorId) return;

  req.log = req._baseLog.child({ actorId });
  req._logActorId = actorId;
}

export function requestLogContextMiddleware(req, res, next) {
  if (!req._baseLog) {
    const baseLogger = req?.log || log;
    req._baseLog = req?.id ? baseLogger.child({ requestId: req.id }) : baseLogger;
    req.log = req._baseLog;
  }

  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    if (shouldIgnoreRequestLog(req)) return;

    const status = Number(res.statusCode || 0);
    const duration = Number((process.hrtime.bigint() - startedAt) / 1000000n);
    const userId = req?.user?.uid ?? req?.auth?.uid ?? undefined;
    const requestLogger = req?._baseLog || req?.log || log;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    requestLogger[level](
      {
        method: req.method,
        path: getRequestPath(req),
        status,
        duration,
        userId,
      },
      "request completed"
    );
  });

  attachActorLogContext(req);
  next();
}

function getRequestPath(req) {
  const raw = String(req?.originalUrl || req?.url || "");
  const qIndex = raw.indexOf("?");
  return qIndex >= 0 ? raw.slice(0, qIndex) : raw;
}

function shouldIgnoreRequestLog(req) {
  const path = getRequestPath(req);
  return path.startsWith("/health") || path.startsWith("/api/v1/health");
}
