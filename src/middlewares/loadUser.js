import { getFirestoreInstance } from "../config/firebase.js";
import { fail } from "../utils/apiResponse.js";

export async function loadUser(req, res, next) {
    try {
        // Dev mode mock
        if (process.env.NODE_ENV === "dev" && req.auth?.uid === "dev-test-user-123") {
            if (!req.user) {
                req.user = {
                    uid: "dev-test-user-123",
                    email: "test_user@jm.dev",
                    name: "Test User",
                    role: "user",
                    roles: ["user"],
                    status: "active",
                    onboardingState: "new",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
            }
            return next();
        }

        // Real user load
        if (req.user) return next();
        if (!req.auth) {
            return fail(res, "NO_AUTH", "Auth info missing", 401);
        }

        const db = getFirestoreInstance();
        const userRef = db.collection("users").doc(req.auth.uid);
        const snap = await userRef.get();

        if (!snap.exists) {
            return fail(res, "USER_NOT_FOUND", "User profile not found", 404);
        }

        req.user = snap.data();
        next();
    } catch (err) {
        return fail(res, "LOAD_USER_ERROR", err.message, 500);
    }
}
