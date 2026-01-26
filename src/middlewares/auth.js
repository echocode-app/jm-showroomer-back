import { getAuthInstance, getFirestoreInstance } from "../config/firebase.js";
import { fail } from "../utils/apiResponse.js";

export async function authMiddleware(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return fail(res, "AUTH_MISSING", "Authorization token missing", 401);
        }

        const token = header.split(" ")[1];

        // DEV mode: allow test token without Firebase
        if (process.env.NODE_ENV === "dev" && token === "TEST_ID_TOKEN") {
            const devUser = {
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

            // для loadUser
            req.auth = { uid: devUser.uid };
            req.user = devUser;

            return next();
        }

        // Production / real token verification
        const auth = getAuthInstance();
        const decoded = await auth.verifyIdToken(token);

        req.auth = decoded;
        next();
    } catch (err) {
        return fail(res, "AUTH_INVALID", "Invalid or expired token", 401);
    }
}
