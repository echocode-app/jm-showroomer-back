import { log } from "../config/logger.js";

export function requestLogger(req, res, next) {
    log.info(`[${req.method}] ${req.originalUrl}`);
    next();
}
