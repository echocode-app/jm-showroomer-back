import { getFirestoreInstance } from "../config/firebase.js";

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
            req.user = snap.data();
        }
    } catch (e) {
        // user optional, fail silently
    }

    next();
}
