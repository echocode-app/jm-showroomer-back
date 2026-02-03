import { log } from "../config/logger.js";

// requestLogger
export function requestLogger(req, res, next) {
    log.info(`[${req.method}] ${req.originalUrl}`);
    next();
}
