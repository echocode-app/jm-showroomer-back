import { getFirestoreInstance, getMessagingInstance } from "../../config/firebase.js";
import { log } from "../../config/logger.js";

export async function sendPushToUser(uid, payload) {
    try {
        if (!isPushEnabled()) {
            return { skipped: true, reason: "push_disabled" };
        }
        if (!uid || typeof uid !== "string") {
            return { skipped: true, reason: "invalid_uid" };
        }

        const db = getFirestoreInstance();
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) {
            return { skipped: true, reason: "user_not_found" };
        }

        const user = userSnap.data() || {};
        if (user.notificationsEnabled === false) {
            return { skipped: true, reason: "user_notifications_disabled" };
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
            return { skipped: true, reason: "no_tokens" };
        }

        const messaging = getMessagingInstance();
        const response = await messaging.sendEachForMulticast({
            tokens,
            notification: {
                title: String(payload?.notification?.title || ""),
                body: String(payload?.notification?.body || ""),
            },
            data: {
                type: String(payload?.data?.type || ""),
                resourceType: String(payload?.data?.resourceType || ""),
                resourceId: String(payload?.data?.resourceId || ""),
                notificationId: String(payload?.data?.notificationId || ""),
            },
        });

        if (response.failureCount > 0) {
            const sampleCodes = response.responses
                .filter(item => !item.success)
                .map(item => item.error?.code || "unknown")
                .slice(0, 3);
            log.error(
                `Push send partial failure uid=${uid} success=${response.successCount} failure=${response.failureCount} sampleCodes=${sampleCodes.join(",")}`
            );
        }

        return {
            skipped: false,
            successCount: response.successCount,
            failureCount: response.failureCount,
        };
    } catch (err) {
        log.error(`Push send skipped uid=${uid}: ${err?.message || err}`);
        return { skipped: true, reason: "send_error" };
    }
}

function isPushEnabled() {
    if ((process.env.NODE_ENV || "dev") === "test") {
        return false;
    }
    return process.env.PUSH_ENABLED === "true";
}
