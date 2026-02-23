import { log } from "../config/logger.js";
import { getMessageForCode, getStatusForCode } from "../core/errorCodes.js";

// errorHandler
export const errorHandler = (err, req, res, next) => {
  if (req?._anonymousIdForResponse) {
    res.set("x-anonymous-id", req._anonymousIdForResponse);
  }

  const code = err.code || "INTERNAL_ERROR";
  const status = getStatusForCode(code) ?? err.status ?? 500;
  const message = getMessageForCode(code, err.message || "Internal server error");
  const requestLog = req?.log ?? log;
  const isDev = process.env.NODE_ENV === "dev";

  if (status >= 500) {
    if (isDev) {
      requestLog.error({ err, code, status }, "request failed");
    } else {
      requestLog.error(
        {
          code,
          status,
          err: {
            message: err?.message || "Internal server error",
            type: err?.name || "Error",
          },
        },
        "request failed"
      );
    }
  } else {
    requestLog.warn({ code, status, err: { message } }, "request failed");
  }

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
};
