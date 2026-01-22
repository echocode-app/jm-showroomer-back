import { getAuthInstance, getFirestoreInstance } from "../config/firebase.js";

export async function verifyOAuthToken(idToken) {
    const auth = getAuthInstance();
    const db = getFirestoreInstance();

    if (!idToken) {
        const err = new Error("Missing idToken");
        err.status = 400;
        throw err;
    }

    let decoded;
    try {
        decoded = await auth.verifyIdToken(idToken);
    } catch (e) {
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
            status: "active",
            onboardingState: "new",

            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await userRef.set(firestoreUser);
    } else {
        firestoreUser = snap.data();
    }

    return firestoreUser;
}

// {
//   "uid": "<uid>",
//   "email": "<email>",
//   "name": "<name|null>",
//   "avatar": "<picture|null>",
//   "role": "user", 
//   "roles": ["user"],
//   "status": "active",    // active / suspended / banned
//   "onboardingState": "new",  // new / completed
//   "createdAt": "<ISO>",
//   "updatedAt": "<ISO>"
// }


