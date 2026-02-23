import { getFirestoreInstance } from "../../config/firebase.js";
import { DEV_STORE, useDevMock } from "../showrooms/_store.js";
import { assertUserWritableInTx } from "./writeGuardService.js";

/**
 * Returns a Firestore reference to the user profile document.
 */
function getUserRef(userId) {
    const db = getFirestoreInstance();
    return db.collection("users").doc(userId);
}

function buildSoftDeleteProfileUpdate(now) {
    return {
        isDeleted: true,
        deletedAt: now,
        deleteLock: null,
        deleteLockAt: null,
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
    };
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
    const db = getFirestoreInstance();
    const ref = getUserRef(userId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, userId);
        tx.update(ref, {
            country,
            onboardingState: "completed",
            updatedAt: new Date().toISOString(),
        });
    });
}

/**
 * Promotes user to owner and writes required owner profile fields.
 */
export async function updateOwnerProfile(userId, payload) {
    const { name, country, ownerProfile, updatedAt } = payload;
    const db = getFirestoreInstance();
    const ref = getUserRef(userId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, userId);
        tx.update(ref, {
            name,
            country,
            onboardingState: "completed",
            role: "owner",
            roles: ["owner"],
            ownerProfile,
            updatedAt,
        });
    });
}

/**
 * Applies a partial profile update payload.
 */
export async function updateUserProfileDoc(userId, updates) {
    const db = getFirestoreInstance();
    const ref = getUserRef(userId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, userId);
        tx.update(ref, updates);
    });
}

/**
 * Dev-only helper to force owner role for local testing.
 */
export async function makeOwnerDevUser(userId) {
    const db = getFirestoreInstance();
    const ref = getUserRef(userId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, userId);
        tx.update(ref, {
            role: "owner",
            roles: ["owner"],
            updatedAt: new Date().toISOString(),
        });
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
    // Canonical lookbook ownership field is `authorId` (legacy docs may still use `ownerUid`).
    const [authorSnapshot, legacyOwnerSnapshot] = await Promise.all([
        db
            .collection("lookbooks")
            .where("authorId", "==", ownerUid)
            .limit(1)
            .get(),
        db
            .collection("lookbooks")
            .where("ownerUid", "==", ownerUid)
            .limit(1)
            .get(),
    ]);
    return !authorSnapshot.empty || !legacyOwnerSnapshot.empty;
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

async function acquireUserDeleteLock(userId) {
    const db = getFirestoreInstance();
    const ref = getUserRef(userId);

    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            return { status: "not_found" };
        }

        const user = snap.data() || {};
        if (user.isDeleted === true) {
            return { status: "already_deleted" };
        }

        if (user.deleteLock === true) {
            return { status: "locked" };
        }

        tx.update(ref, {
            deleteLock: true,
            deleteLockAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        return { status: "locked_by_me", user };
    });
}

// Delete-lock lifecycle:
// 1) acquire per-user lock in tx
// 2) run ownership blocker checks outside tx (read-only fan-out)
// 3) finalize soft delete only if lock is still held
// 4) release lock on blocker/error
// This keeps blocker reads scalable while making the final state transition atomic.
async function waitForDeleteLockResolution(userId, { attempts = 5, delayMs = 30 } = {}) {
    for (let i = 0; i < attempts; i += 1) {
        const latest = await getUserById(userId);
        if (!latest) return { status: "not_found" };
        if (latest.isDeleted === true) return { status: "already_deleted" };
        if (latest.deleteLock !== true) return { status: "unlocked" };
        if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return { status: "still_locked" };
}

async function releaseUserDeleteLock(userId) {
    const db = getFirestoreInstance();
    const ref = getUserRef(userId);

    await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const user = snap.data() || {};
        if (user.isDeleted === true) return;
        tx.update(ref, {
            deleteLock: null,
            deleteLockAt: null,
            updatedAt: new Date().toISOString(),
        });
    });
}

async function finalizeSoftDeleteWithLock(userId) {
    const db = getFirestoreInstance();
    const ref = getUserRef(userId);
    const now = new Date().toISOString();

    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { status: "not_found" };
        const user = snap.data() || {};
        if (user.isDeleted === true) return { status: "already_deleted" };
        if (user.deleteLock !== true) return { status: "lock_lost" };
        tx.update(ref, buildSoftDeleteProfileUpdate(now));
        return { status: "deleted" };
    });
}

export async function deleteUserAccountWithBlockGuard(userId, retryCount = 0) {
    const lockResult = await acquireUserDeleteLock(userId);
    if (lockResult.status === "not_found") {
        return { status: "not_found" };
    }
    if (lockResult.status === "already_deleted") {
        return { status: "already_deleted" };
    }
    if (lockResult.status === "locked") {
        const waitResult = await waitForDeleteLockResolution(userId);
        if (waitResult.status === "not_found") return { status: "not_found" };
        if (waitResult.status === "already_deleted") return { status: "already_deleted" };
        if (waitResult.status === "unlocked") {
            if (retryCount >= 2) return { status: "delete_in_progress" };
            return deleteUserAccountWithBlockGuard(userId, retryCount + 1);
        }
        return { status: "delete_in_progress" };
    }

    let blockers;
    try {
        const [showrooms, lookbooks, events] = await Promise.all([
            ownerHasActiveShowrooms(userId),
            ownerHasLookbooks(userId),
            ownerHasEvents(userId),
        ]);
        blockers = { showrooms, lookbooks, events };
    } catch (err) {
        await releaseUserDeleteLock(userId);
        throw err;
    }

    if (blockers.showrooms || blockers.lookbooks || blockers.events) {
        await releaseUserDeleteLock(userId);
        return { status: "blocked", blockers };
    }

    const finalize = await finalizeSoftDeleteWithLock(userId);
    if (finalize.status === "already_deleted") {
        return { status: "already_deleted" };
    }
    if (finalize.status !== "deleted") {
        // If lock was lost unexpectedly, surface a retry-safe in-progress outcome instead of
        // a misleading ownership blocker.
        return { status: "delete_in_progress" };
    }
    return { status: "deleted", blockers };
}
