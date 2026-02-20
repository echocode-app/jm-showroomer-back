import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../../config/firebase.js";
import { runFirestoreTransaction } from "../../../utils/firestoreTransaction.js";
import { normalizeDevicePayload } from "./validation.js";

// Purpose: Register/update one user device document.
// Responsibility: Idempotent upsert under users/{uid}/devices/{deviceId}.
// Invariant: existing device-level notificationsEnabled flag is preserved.

export async function registerUserDevice(uid, payload) {
    const normalized = normalizeDevicePayload(payload);
    const db = getFirestoreInstance();
    const ref = db.collection("users").doc(uid).collection("devices").doc(normalized.deviceId);

    await runFirestoreTransaction(db, async tx => {
        const snap = await tx.get(ref);
        const existing = snap.exists ? snap.data() : null;

        const patch = {
            fcmToken: normalized.fcmToken,
            platform: normalized.platform,
            appVersion: normalized.appVersion,
            locale: normalized.locale,
            notificationsEnabled: existing?.notificationsEnabled === false ? false : true,
            updatedAt: FieldValue.serverTimestamp(),
            lastSeenAt: FieldValue.serverTimestamp(),
        };

        if (!snap.exists) {
            patch.createdAt = FieldValue.serverTimestamp();
            tx.set(ref, patch);
            return;
        }

        tx.set(ref, patch, { merge: true });
    });
}
