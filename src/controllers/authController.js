import { verifyOAuthToken } from "../services/authService.js";
import { ok, fail } from "../utils/apiResponse.js";

export async function oauthLogin(req, res, next) {
    try {
        const { idToken } = req.body;
        const user = await verifyOAuthToken(idToken);

        return ok(res, { user });
    } catch (err) {
        return fail(res, err.code || "AUTH_ERROR", err.message, err.status);
    }
}
