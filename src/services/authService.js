import { getAuthInstance, getFirestoreInstance } from "../config/firebase.js";
import { isCountryBlocked } from "../constants/countries.js";

// verifyOAuthToken
export async function verifyOAuthToken(idToken) {
    if (!idToken) {
        const err = new Error("Missing idToken");
        err.status = 400;
        throw err;
    }

    const auth = getAuthInstance();
    const db = getFirestoreInstance();

    let decoded;
    try {
        decoded = await auth.verifyIdToken(idToken);
    } catch {
        const err = new Error("Invalid token");
        err.status = 401;
        throw err;
    }

    const { uid, email, name, picture } = decoded;

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    let firestoreUser;

    if (!snap.exists) {
        const now = new Date().toISOString();

        firestoreUser = {
            uid,
            email: email || null,
            name: name || null,
            avatar: picture || null,
            role: "user",
            roles: ["user"],
            country: null,
            status: "active",
            onboardingState: "new",
            createdAt: now,
            updatedAt: now,
        };

        await userRef.set(firestoreUser);
    } else {
        firestoreUser = snap.data();
    }

    return firestoreUser;
}
