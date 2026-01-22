import { fail } from "../utils/apiResponse.js";
import { ROLES } from "../constants/roles.js";
import { log } from "../config/logger.js";

export function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            log.error(`FORBIDDEN: user ${req.user?.uid || "anonymous"} tried to access roles ${allowedRoles}`);
            return fail(res, "FORBIDDEN", "Access denied", 403);
        }
        next();
    };
}
