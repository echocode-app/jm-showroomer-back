import { getFirestoreInstance, getMessagingInstance } from "../../config/firebase.js";
import { log } from "../../config/logger.js";
import { isPushEnabled } from "./envGuard.js";
import { buildMulticastPayload } from "./payloadBuilder.js";
import { resolveUserPushTargets } from "./tokenResolver.js";

// Purpose: MVP push dispatch service.
// Responsibility: Execute gated sendEachForMulticast without breaking business flow.
// Invariants:
// - never throws to callers
// - never logs raw fcm tokens
// - honors user and device opt-out flags

export async function sendPushToUser(uid, payload) {
    try {
        // Guard: feature flag and test env hard-disable.
        if (!isPushEnabled()) {
            return { skipped: true, reason: "push_disabled" };
        }

        const targets = await resolveUserPushTargets(uid);
        if (targets.skipped) {
            return { skipped: true, reason: targets.reason };
        }

        const messaging = getMessagingInstance();
        const response = await messaging.sendEachForMulticast(
            buildMulticastPayload(targets.tokens, payload)
        );

        await cleanupPermanentInvalidTokens(uid, targets, response);

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

const PERMANENT_TOKEN_ERROR_CODES = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
    "registration-token-not-registered",
    "invalid-registration-token",
]);

async function cleanupPermanentInvalidTokens(uid, targets, response) {
    if (!response?.responses || response.responses.length === 0) return;
    const tokenToDeviceIds = targets?.tokenToDeviceIds || {};
    const staleDeviceIds = new Set();

    response.responses.forEach((item, index) => {
        if (item?.success) return;
        const code = item?.error?.code || "";
        if (!PERMANENT_TOKEN_ERROR_CODES.has(code)) return;
        const token = targets.tokens[index];
        if (!token) return;
        const deviceIds = tokenToDeviceIds[token] || [];
        deviceIds.forEach(deviceId => staleDeviceIds.add(deviceId));
    });

    if (staleDeviceIds.size === 0) return;

    const db = getFirestoreInstance();
    const batch = db.batch();
    staleDeviceIds.forEach(deviceId => {
        const ref = db.collection("users").doc(uid).collection("devices").doc(deviceId);
        batch.delete(ref);
    });
    await batch.commit();

    log.info(
        `Push stale token cleanup uid=${uid} removedDevices=${staleDeviceIds.size}`
    );
}
