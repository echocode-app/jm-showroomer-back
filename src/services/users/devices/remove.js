import { getFirestoreInstance } from "../../../config/firebase.js";
import { runFirestoreTransaction } from "../../../utils/firestoreTransaction.js";
import { assertUserWritableInTx } from "../writeGuardService.js";

// Purpose: Remove one user device registration.
// Responsibility: Delete users/{uid}/devices/{deviceId}.
// Invariant: operation is idempotent.

export async function removeUserDevice(uid, deviceId) {
    const db = getFirestoreInstance();
    const ref = db.collection("users").doc(uid).collection("devices").doc(deviceId);
    await runFirestoreTransaction(db, async tx => {
        await assertUserWritableInTx(tx, uid);
        tx.delete(ref);
    });
}
