import { log } from "../config/logger.js";
import { getMessageForCode, getStatusForCode } from "../core/errorCodes.js";
import { logDomainEvent } from "../utils/logDomainEvent.js";
import { classifyError } from "../utils/errorClassifier.js";

// `INDEX_NOT_READY` is logged centrally here to keep service errors response-focused.
// Duplicate guard uses `err.__domainLogged` so a controller/helper-emitted domain log wins.
function inferIndexCollection(req, err) {
  const explicit = err?.meta?.collection;
  if (typeof explicit === "string" && explicit.trim()) return explicit;

  const url = String(req?.originalUrl || req?.url || "").toLowerCase();
  if (url.includes("/showrooms")) return "showrooms";
  if (url.includes("/lookbooks")) return "lookbooks";
  if (url.includes("/events")) return "events";
  return "unknown";
}

function getFullRequestUrl(req) {
  return String(req?.originalUrl || req?.url || "");
}

// errorHandler
export const errorHandler = (err, req, res, next) => {
  if (req?._anonymousIdForResponse) {
    res.set("x-anonymous-id", req._anonymousIdForResponse);
  }

  const code = err.code || "INTERNAL_ERROR";
  const status = getStatusForCode(code) ?? err.status ?? 500;
  const message =
    status >= 500
      ? getMessageForCode(code, "Internal server error")
      : getMessageForCode(code, err.message || "Request failed");
  const requestLog = req?._baseLog ?? req?.log ?? log;
  const isDev = process.env.NODE_ENV === "dev";
  const errorLogPayload = {
    requestId: req?.id,
    method: req?.method,
    path: getFullRequestUrl(req).split("?")[0],
    originalUrl: getFullRequestUrl(req),
    status,
    code,
    message,
    userId: req?.user?.uid ?? req?.auth?.uid ?? undefined,
  };
  if (code === "INDEX_NOT_READY" && err?.meta?.firestoreMessage) {
    errorLogPayload.firestoreMessage = err.meta.firestoreMessage;
  }
  if (isDev && err?.stack) {
    errorLogPayload.stack = err.stack;
  }

  if (code === "INDEX_NOT_READY" && !err?.__domainLogged) {
    const { level } = classifyError({ code, status });
    logDomainEvent(req, {
      domain: "system",
      event: "index_not_ready",
      status: "infra",
      meta: {
        collection: inferIndexCollection(req, err),
        originalUrl: getFullRequestUrl(req),
        firestoreMessage: err?.meta?.firestoreMessage ?? null,
      },
    }, level, err);
  }

  if (status >= 500) {
    requestLog.error(errorLogPayload, "request failed");
  } else {
    requestLog.warn(errorLogPayload, "request failed");
  }

  const errorBody = {
    code,
    message,
  };
  if (err?.meta && typeof err.meta === "object" && !Array.isArray(err.meta)) {
    errorBody.meta = err.meta;
  }

  res.status(status).json({
    success: false,
    error: errorBody,
  });
};
