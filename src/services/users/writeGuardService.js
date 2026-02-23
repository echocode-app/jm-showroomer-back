import { getFirestoreInstance } from "../../config/firebase.js";
import { notFound } from "../../core/error.js";

/**
 * Canonical user writability invariant (service-layer enforcement):
 * a user is writable only when the profile exists, is not soft-deleted,
 * and is not currently protected by an account-deletion lock.
 *
 * Use `assertUserWritableInTx` for any transactional mutation.
 * `assertUserWritable` is acceptable for non-transactional prechecks only when
 * followed by a transaction or when the write path is non-destructive/idempotent
 * and cannot violate ownership invariants.
 */
function getUserRef(uid) {
    return getFirestoreInstance().collection("users").doc(uid);
}

function assertUserWritableData(user) {
    if (!user || user.isDeleted === true || user.deleteLock === true) {
        throw notFound("USER_NOT_FOUND");
    }
}

export async function assertUserWritable(uid) {
    if (!uid) throw notFound("USER_NOT_FOUND");
    const snap = await getUserRef(uid).get();
    if (!snap.exists) throw notFound("USER_NOT_FOUND");
    const user = snap.data() || {};
    assertUserWritableData(user);
    return user;
}

export async function assertUserWritableInTx(tx, uid) {
    if (!uid) throw notFound("USER_NOT_FOUND");
    const ref = getFirestoreInstance().collection("users").doc(uid);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("USER_NOT_FOUND");
    const user = snap.data() || {};
    assertUserWritableData(user);
    return user;
}

export async function runUserWriteTransaction(uid, callback) {
    const db = getFirestoreInstance();
    return db.runTransaction(async tx => {
        const user = await assertUserWritableInTx(tx, uid);
        return callback(tx, user);
    });
}
