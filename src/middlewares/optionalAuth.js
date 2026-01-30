import { getAuthInstance } from "../config/firebase.js";

export async function optionalAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return next();
    }

    const token = header.split(" ")[1];

    try {
        const auth = getAuthInstance();
        const decoded = await auth.verifyIdToken(token);
        req.auth = decoded;
    } catch (e) {
        // invalid token, proceed without auth
    }

    next();
}
