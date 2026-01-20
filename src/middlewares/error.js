import { log } from "../config/logger.js";

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Internal server error";

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
