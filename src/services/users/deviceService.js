import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";

function userDevicesCollection(uid) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection("devices");
}

export async function upsertUserDevice(uid, payload) {
    const ref = userDevicesCollection(uid).doc(payload.deviceId);
    const db = getFirestoreInstance();

    await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const existing = snap.exists ? snap.data() : null;

        const patch = {
            fcmToken: payload.fcmToken,
            platform: payload.platform,
            appVersion: payload.appVersion ?? null,
            locale: payload.locale ?? null,
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

export async function deleteUserDevice(uid, deviceId) {
    await userDevicesCollection(uid).doc(deviceId).delete();
}
