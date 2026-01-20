import { log } from "../config/logger.js";

export const errorHandler = (err, req, res, next) => {
    log.error(err.message);
    res.status(err.status || 500).json({
        error: {
            code: err.code || "INTERNAL_ERROR",
            message: err.message || "Internal server error"
        }
    });
};
