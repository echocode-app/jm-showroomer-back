import { getFirestoreInstance } from "../../config/firebase.js";
import { DEV_STORE, useDevMock } from "../showrooms/_store.js";

/**
 * Returns a Firestore reference to the user profile document.
 */
function getUserRef(userId) {
    const db = getFirestoreInstance();
    return db.collection("users").doc(userId);
}

/**
 * Loads user profile by uid or returns null if not found.
 */
export async function getUserById(userId) {
    if (!userId) return null;
    const ref = getUserRef(userId);
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
}

/**
 * Finalizes onboarding state and country.
 */
export async function updateUserOnboarding(userId, country) {
    const ref = getUserRef(userId);
    await ref.update({
        country,
        onboardingState: "completed",
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Promotes user to owner and writes required owner profile fields.
 */
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

/**
 * Applies a partial profile update payload.
 */
export async function updateUserProfileDoc(userId, updates) {
    const ref = getUserRef(userId);
    await ref.update(updates);
}

/**
 * Soft-deletes user profile and clears personal data fields.
 */
export async function softDeleteUserProfile(userId) {
    const ref = getUserRef(userId);
    const now = new Date().toISOString();
    await ref.update({
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
        email: null,
        name: null,
        avatar: null,
        instagram: null,
        position: null,
        appLanguage: null,
        notificationsEnabled: null,
        "ownerProfile.name": null,
        "ownerProfile.position": null,
        "ownerProfile.instagram": null,
    });
}

/**
 * Dev-only helper to force owner role for local testing.
 */
export async function makeOwnerDevUser(userId) {
    const ref = getUserRef(userId);
    await ref.update({
        role: "owner",
        roles: ["owner"],
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Checks whether owner still has any showroom that blocks profile deletion.
 */
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

/**
 * Checks if owner has lookbooks.
 */
export async function ownerHasLookbooks(ownerUid) {
    const db = getFirestoreInstance();
    const snapshot = await db
        .collection("lookbooks")
        .where("ownerUid", "==", ownerUid)
        .limit(1)
        .get();
    return !snapshot.empty;
}

/**
 * Checks if owner has events.
 */
export async function ownerHasEvents(ownerUid) {
    const db = getFirestoreInstance();
    const snapshot = await db
        .collection("events")
        .where("ownerUid", "==", ownerUid)
        .limit(1)
        .get();
    return !snapshot.empty;
}
