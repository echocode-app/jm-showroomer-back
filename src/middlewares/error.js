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

  if (status >= 500) {
    log.fatal(`${code}: ${message}`);
    if (process.env.NODE_ENV === "dev") console.error(err.stack);
  } else {
    log.error(`${code}: ${message}`);
  }

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
};
