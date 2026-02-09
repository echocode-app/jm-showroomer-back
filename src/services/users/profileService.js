import { getFirestoreInstance } from "../../config/firebase.js";
import { DEV_STORE, useDevMock } from "../showrooms/_store.js";

// getUserRef
function getUserRef(userId) {
    const db = getFirestoreInstance();
    return db.collection("users").doc(userId);
}

// updateUserOnboarding
export async function updateUserOnboarding(userId, country) {
    const ref = getUserRef(userId);
    await ref.update({
        country,
        onboardingState: "completed",
        updatedAt: new Date().toISOString(),
    });
}

// updateOwnerProfile
export async function updateOwnerProfile(userId, payload) {
    const { name, country, ownerProfile, updatedAt } = payload;
    const ref = getUserRef(userId);
    await ref.update({
        name,
        country,
        onboardingState: "completed",
        role: "owner",
        roles: ["owner"],
        ownerProfile,
        updatedAt,
    });
}

// updateUserProfileDoc
export async function updateUserProfileDoc(userId, updates) {
    const ref = getUserRef(userId);
    await ref.update(updates);
}

// makeOwnerDevUser
export async function makeOwnerDevUser(userId) {
    const ref = getUserRef(userId);
    await ref.update({
        role: "owner",
        roles: ["owner"],
        updatedAt: new Date().toISOString(),
    });
}

// ownerHasActiveShowrooms
export async function ownerHasActiveShowrooms(ownerUid) {
    if (!ownerUid) return false;
    if (useDevMock) {
        return DEV_STORE.showrooms.some(
            s =>
                s.ownerUid === ownerUid &&
                ["draft", "pending", "approved", "rejected"].includes(s.status)
        );
    }
    const db = getFirestoreInstance();
    const snapshot = await db
        .collection("showrooms")
        .where("ownerUid", "==", ownerUid)
        .where("status", "in", ["draft", "pending", "approved", "rejected"])
        .limit(1)
        .get();
    return !snapshot.empty;
}

// ownerHasLookbooks
export async function ownerHasLookbooks(ownerUid) {
    const db = getFirestoreInstance();
    const snapshot = await db
        .collection("lookbooks")
        .where("ownerUid", "==", ownerUid)
        .limit(1)
        .get();
    return !snapshot.empty;
}

// ownerHasEvents
export async function ownerHasEvents(ownerUid) {
    const db = getFirestoreInstance();
    const snapshot = await db
        .collection("events")
        .where("ownerUid", "==", ownerUid)
        .limit(1)
        .get();
    return !snapshot.empty;
}
