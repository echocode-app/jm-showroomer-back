import { getFirestoreInstance } from "../../../config/firebase.js";

// Purpose: Remove one user device registration.
// Responsibility: Delete users/{uid}/devices/{deviceId}.
// Invariant: operation is idempotent.

export async function removeUserDevice(uid, deviceId) {
    await getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("devices")
        .doc(deviceId)
        .delete();
}
