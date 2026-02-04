import { verifyOAuthToken } from "../services/authService.js";
import { ok, fail } from "../utils/apiResponse.js";
import { log } from "../config/logger.js";

// oauthLogin
export async function oauthLogin(req, res, next) {
    try {
        const { idToken } = req.body;
        const { user, signInProvider } = await verifyOAuthToken(idToken);
        log.info(`firebase.sign_in_provider: ${signInProvider || "unknown"}`);

        return ok(res, { user });
    } catch (err) {
        return fail(res, err.code || "AUTH_ERROR", err.message, err.status);
    }
}
