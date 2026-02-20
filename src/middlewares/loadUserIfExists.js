import { getFirestoreInstance } from "../config/firebase.js";
import { log } from "../config/logger.js";

// loadUserIfExists
export async function loadUserIfExists(req, res, next) {
    if (!req.auth?.uid) {
        return next();
    }

    try {
        const db = getFirestoreInstance();
        const ref = db.collection("users").doc(req.auth.uid);
        const snap = await ref.get();

        if (snap.exists) {
            const user = snap.data();
            if (!user?.isDeleted) {
                req.user = user;
            }
        }
    } catch (e) {
        // User is optional for public endpoints; do not fail request on lookup issues.
        if (process.env.NODE_ENV === "dev") {
            log.error(`loadUserIfExists skipped: ${e?.message || e}`);
        }
    }

    next();
}
