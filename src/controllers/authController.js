import { verifyOAuthToken } from "../services/authService.js";
import { ok } from "../utils/apiResponse.js";

export async function oauthLogin(req, res, next) {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            const err = new Error("Missing idToken");
            err.status = 400;
            err.code = "MISSING_TOKEN";
            throw err;
        }

        const user = await verifyOAuthToken(idToken);

        return ok(res, { user });
    } catch (err) {
        next(err);
    }
}
