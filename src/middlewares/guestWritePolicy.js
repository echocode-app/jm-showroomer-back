import { CONFIG } from "../config/index.js";
import { fail } from "../utils/apiResponse.js";

// Production hardening for lookbook write paths.
// By default in prod, write operations require authenticated identity.
export function requireLookbookWriteIdentity(req, res, next) {
  if (CONFIG.allowGuestLookbookWrites) {
    return next();
  }

  if (!req.auth?.uid) {
    return fail(res, "AUTH_MISSING", "Authorization token missing", 401);
  }

  next();
}
