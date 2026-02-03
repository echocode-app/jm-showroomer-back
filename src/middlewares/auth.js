import { getAuthInstance, getFirestoreInstance } from "../config/firebase.js";
import { fail } from "../utils/apiResponse.js";

// authMiddleware
export async function authMiddleware(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith("Bearer ")) {
            return fail(res, "AUTH_MISSING", "Authorization token missing", 401);
        }

        const token = header.split(" ")[1];

        const auth = getAuthInstance();
        const decoded = await auth.verifyIdToken(token);

        req.auth = decoded;
        next();
    } catch (err) {
        return fail(res, "AUTH_INVALID", "Invalid or expired token", 401);
    }
}
