import { getFirestoreInstance } from "../config/firebase.js";
import { fail } from "../utils/apiResponse.js";

// loadUser
// Read-path/profile bootstrap middleware.
// Canonical writability invariant is enforced in service-layer write guards
// (`assertUserWritable*`) so write handlers must not rely on this middleware alone.
export async function loadUser(req, res, next) {
    try {
        if (!req.auth) {
            return fail(res, "NO_AUTH", "Auth info missing", 401);
        }

        const db = getFirestoreInstance();
        const userRef = db.collection("users").doc(req.auth.uid);
        const snap = await userRef.get();

        if (!snap.exists) {
            return fail(res, "USER_NOT_FOUND", "User profile not found", 404);
        }

        const user = snap.data();
        if (user?.isDeleted) {
            return fail(res, "USER_NOT_FOUND", "User profile not found", 404);
        }
        const isMutation = !["GET", "HEAD", "OPTIONS"].includes(String(req.method || "GET"));
        if (isMutation && user?.deleteLock === true) {
            return fail(res, "USER_NOT_FOUND", "User profile not found", 404);
        }

        req.user = user;
        next();
    } catch (err) {
        return fail(res, "LOAD_USER_ERROR", err.message, 500);
    }
}
