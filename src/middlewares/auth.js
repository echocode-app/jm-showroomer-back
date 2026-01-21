import { getAuthInstance } from "../config/firebase.js";
import { fail } from "../utils/apiResponse.js";

export async function authMiddleware(req, res, next) {
    try {
        const auth = getAuthInstance();
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return fail(res, "AUTH_MISSING", "Authorization token missing", 401);
        }

        const token = header.split(" ")[1];
        const decoded = await auth.verifyIdToken(token);

        req.user = decoded;
        next();
    } catch (err) {
        return fail(res, "AUTH_INVALID", "Invalid or expired token", 401);
    }
}
