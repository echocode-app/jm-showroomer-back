import { getAuthInstance, getFirestoreInstance } from "../config/firebase.js";
import { isCountryBlocked } from "../constants/countries.js";

function buildActiveUserProfile({ uid, email, name, picture, createdAt, existingUser = null }) {
    const now = new Date().toISOString();
    return {
        uid,
        email: email || null,
        name: name || null,
        avatar: picture || null,
        role: "user",
        roles: ["user"],
        country: null,
        status: "active",
        onboardingState: "new",
        createdAt: createdAt || existingUser?.createdAt || now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
        deleteLock: null,
        deleteLockAt: null,
        instagram: null,
        position: null,
        appLanguage: null,
        notificationsEnabled: true,
        ownerProfile: {
            name: null,
            position: null,
            phone: null,
            instagram: null,
        },
    };
}

// verifyOAuthToken
export async function verifyOAuthToken(idToken) {
    if (!idToken) {
        const err = new Error("Missing idToken");
        err.code = "ID_TOKEN_REQUIRED";
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
        err.code = "AUTH_INVALID";
        err.status = 401;
        throw err;
    }

    const { uid, email, name, picture } = decoded;

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    let firestoreUser;

    if (!snap.exists) {
        firestoreUser = buildActiveUserProfile({
            uid,
            email,
            name,
            picture,
        });

        await userRef.set(firestoreUser);
    } else {
        firestoreUser = snap.data();
        if (firestoreUser?.isDeleted === true) {
            firestoreUser = buildActiveUserProfile({
                uid,
                email,
                name,
                picture,
                existingUser: firestoreUser,
            });
            await userRef.set(firestoreUser, { merge: true });
        }
    }

    return {
        user: firestoreUser,
        signInProvider: decoded?.firebase?.sign_in_provider || null,
    };
}
