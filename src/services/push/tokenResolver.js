import { getFirestoreInstance } from "../../config/firebase.js";

// Purpose: Resolve user-level and device-level eligibility for push.
// Responsibility: Read user prefs + device tokens and apply opt-out gates.
// Invariant: raw tokens are never logged here.

export async function resolveUserPushTargets(uid) {
    if (!uid || typeof uid !== "string") {
        return { skipped: true, reason: "invalid_uid", tokens: [], tokenToDeviceIds: {} };
    }

    const db = getFirestoreInstance();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
        return { skipped: true, reason: "user_not_found", tokens: [], tokenToDeviceIds: {} };
    }

    const user = userSnap.data() || {};
    if (user.notificationsEnabled === false) {
        return {
            skipped: true,
            reason: "user_notifications_disabled",
            tokens: [],
            tokenToDeviceIds: {},
        };
    }

    const devicesSnap = await db.collection("users").doc(uid).collection("devices").get();
    const tokenToDeviceIds = {};
    for (const deviceDoc of devicesSnap.docs) {
        const device = deviceDoc.data() || {};
        if (device.notificationsEnabled === false) continue;
        const token =
            typeof device.fcmToken === "string" ? device.fcmToken.trim() : "";
        if (!token) continue;
        if (!tokenToDeviceIds[token]) tokenToDeviceIds[token] = [];
        tokenToDeviceIds[token].push(deviceDoc.id);
    }
    const tokens = Object.keys(tokenToDeviceIds);

    if (tokens.length === 0) {
        return { skipped: true, reason: "no_tokens", tokens: [], tokenToDeviceIds: {} };
    }

    return { skipped: false, reason: null, tokens, tokenToDeviceIds };
}
