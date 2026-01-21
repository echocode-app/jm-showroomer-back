import { fail } from "../utils/apiResponse.js";
import { log } from "../config/logger.js";

export function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            log.error(`FORBIDDEN: user ${req.user?.uid || "anonymous"} tried to access role ${role}`);
            return fail(res, "FORBIDDEN", "Access denied", 403);
        }
        next();
    };
}
