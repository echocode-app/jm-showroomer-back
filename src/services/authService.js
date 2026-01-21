import { getAuthInstance, getFirestoreInstance } from "../config/firebase.js";

export async function verifyOAuthToken(idToken) {
    const auth = getAuthInstance();
    const db = getFirestoreInstance();

    let decoded;

    try {
        decoded = await auth.verifyIdToken(idToken);
    } catch (e) {
        const err = new Error("Invalid token");
        err.status = 401;
        err.code = "INVALID_TOKEN";
        throw err;
    }

    const { uid, email, name, picture } = decoded;

    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();

    if (!snap.exists) {
        await ref.set({
            uid,
            email: email || null,
            name: name || null,
            avatar: picture || null,
            role: "user",
            onboardingState: "new",
            createdAt: new Date().toISOString(),
        });
    }

    return {
        uid,
        email,
        name,
    };
}
