import { getFirestoreInstance } from "../../config/firebase.js";
import { DEV_STORE, useDevMock } from "../showrooms/_store.js";
import { assertUserWritableInTx } from "./writeGuardService.js";

const DELETE_SCAN_LIMIT = 400;
const USER_SUBCOLLECTIONS = [
    "devices",
    "notifications",
    "showrooms_favorites",
    "lookbooks_favorites",
    "events_want_to_visit",
    "events_dismissed",
];

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
        role: "user",
        roles: ["user"],
        onboardingState: "new",
        country: null,
        email: null,
        name: null,
        avatar: null,
        instagram: null,
        position: null,
        appLanguage: null,
        notificationsEnabled: null,
        "ownerProfile.name": null,
        "ownerProfile.position": null,
        "ownerProfile.phone": null,
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
// 2) cascade cleanup owned entities/subcollections outside tx
// 3) finalize soft delete only if lock is still held
// 4) release lock on error
// This keeps cleanup scalable while making the final state transition atomic.
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

async function scanAllByQuery(baseQuery, limit = DELETE_SCAN_LIMIT) {
    const docs = [];
    let cursor = null;
    while (true) {
        let query = baseQuery.limit(limit);
        if (cursor) {
            query = query.startAfter(cursor);
        }
        const snap = await query.get();
        if (snap.empty) break;
        docs.push(...snap.docs);
        if (snap.docs.length < limit) break;
        cursor = snap.docs[snap.docs.length - 1];
    }
    return docs;
}

async function cleanupOwnedShowrooms(ownerUid) {
    if (!ownerUid) return { softDeleted: 0 };
    if (useDevMock) {
        let softDeleted = 0;
        const now = new Date().toISOString();
        DEV_STORE.showrooms = DEV_STORE.showrooms.map(showroom => {
            if (!showroom || showroom.ownerUid !== ownerUid || showroom.status === "deleted") {
                return showroom;
            }
            softDeleted += 1;
            return {
                ...showroom,
                status: "deleted",
                deletedAt: showroom.deletedAt || now,
                updatedAt: now,
                deletedBy: { uid: ownerUid, role: "self_delete" },
            };
        });
        return { softDeleted };
    }

    const db = getFirestoreInstance();
    const docs = await scanAllByQuery(
        db.collection("showrooms")
            .where("ownerUid", "==", ownerUid)
            .orderBy("__name__")
    );
    const now = new Date().toISOString();
    let softDeleted = 0;
    for (const doc of docs) {
        const data = doc.data() || {};
        if (data.status === "deleted") continue;
        await doc.ref.update({
            status: "deleted",
            deletedAt: data.deletedAt || now,
            updatedAt: now,
            deletedBy: { uid: ownerUid, role: "self_delete" },
        });
        softDeleted += 1;
    }
    return { softDeleted };
}

async function cleanupOwnedLookbooks(ownerUid) {
    if (!ownerUid) return { deleted: 0 };
    const db = getFirestoreInstance();
    const [authorDocs, legacyOwnerDocs] = await Promise.all([
        scanAllByQuery(
            db.collection("lookbooks")
                .where("authorId", "==", ownerUid)
                .orderBy("__name__")
        ),
        scanAllByQuery(
            db.collection("lookbooks")
                .where("ownerUid", "==", ownerUid)
                .orderBy("__name__")
        ),
    ]);

    const refs = new Map();
    [...authorDocs, ...legacyOwnerDocs].forEach(doc => refs.set(doc.ref.path, doc.ref));
    const hasRecursiveDelete = typeof db.recursiveDelete === "function";

    for (const ref of refs.values()) {
        if (hasRecursiveDelete) {
            await db.recursiveDelete(ref);
            continue;
        }
        await ref.delete();
    }

    return { deleted: refs.size };
}

async function cleanupOwnedEvents(ownerUid) {
    if (!ownerUid) return { deleted: 0 };
    const db = getFirestoreInstance();
    const docs = await scanAllByQuery(
        db.collection("events")
            .where("ownerUid", "==", ownerUid)
            .orderBy("__name__")
    );
    for (const doc of docs) {
        await doc.ref.delete();
    }
    return { deleted: docs.length };
}

async function deleteCollectionDocs(collectionRef) {
    let deleted = 0;
    while (true) {
        const snap = await collectionRef.limit(DELETE_SCAN_LIMIT).get();
        if (snap.empty) return deleted;
        for (const doc of snap.docs) {
            await doc.ref.delete();
            deleted += 1;
        }
    }
}

async function cleanupUserSubcollections(userId) {
    const db = getFirestoreInstance();
    const userRef = getUserRef(userId);
    const deleted = {};

    if (typeof userRef.listCollections === "function") {
        const subcollections = await userRef.listCollections();
        for (const subcollection of subcollections) {
            if (typeof db.recursiveDelete === "function") {
                await db.recursiveDelete(subcollection);
                deleted[subcollection.id] = "recursive";
            } else {
                deleted[subcollection.id] = await deleteCollectionDocs(subcollection);
            }
        }
        return deleted;
    }

    if (typeof userRef.collection !== "function") {
        return deleted;
    }

    for (const subcollectionName of USER_SUBCOLLECTIONS) {
        const collectionRef = userRef.collection(subcollectionName);
        deleted[subcollectionName] = await deleteCollectionDocs(collectionRef);
    }
    return deleted;
}

async function cleanupOwnedBusinessEntities(ownerUid) {
    const [showrooms, lookbooks, events] = await Promise.all([
        cleanupOwnedShowrooms(ownerUid),
        cleanupOwnedLookbooks(ownerUid),
        cleanupOwnedEvents(ownerUid),
    ]);
    return { showrooms, lookbooks, events };
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

    try {
        const cleanup = await cleanupOwnedBusinessEntities(userId);
        const subcollections = await cleanupUserSubcollections(userId);
        const finalize = await finalizeSoftDeleteWithLock(userId);
        if (finalize.status === "already_deleted") {
            return { status: "already_deleted" };
        }
        if (finalize.status !== "deleted") {
            return { status: "delete_in_progress" };
        }
        return { status: "deleted", cleanup, subcollections };
    } catch (err) {
        await releaseUserDeleteLock(userId);
        throw err;
    }
}
