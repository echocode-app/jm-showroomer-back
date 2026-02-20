import { getFirestoreInstance } from "../../config/firebase.js";

// Purpose: Resolve user-level and device-level eligibility for push.
// Responsibility: Read user prefs + device tokens and apply opt-out gates.
// Invariant: raw tokens are never logged here.

export async function resolveUserPushTargets(uid) {
    if (!uid || typeof uid !== "string") {
        return { skipped: true, reason: "invalid_uid", tokens: [] };
    }

    const db = getFirestoreInstance();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
        return { skipped: true, reason: "user_not_found", tokens: [] };
    }

    const user = userSnap.data() || {};
    if (user.notificationsEnabled === false) {
        return { skipped: true, reason: "user_notifications_disabled", tokens: [] };
    }

    const devicesSnap = await db.collection("users").doc(uid).collection("devices").get();
    const tokens = Array.from(new Set(
        devicesSnap.docs
            .map(doc => doc.data() || {})
            .filter(device => device.notificationsEnabled !== false)
            .map(device => (typeof device.fcmToken === "string" ? device.fcmToken.trim() : ""))
            .filter(Boolean)
    ));

    if (tokens.length === 0) {
        return { skipped: true, reason: "no_tokens", tokens: [] };
    }

    return { skipped: false, reason: null, tokens };
}
