import { badRequest } from "../../../core/error.js";

// Purpose: Normalize and validate device registration payload for service-level safety.
// Responsibility: Defensive validation before Firestore write.
// Invariant: normalized payload never contains empty deviceId/token.

export function normalizeDevicePayload(payload = {}) {
    const deviceId = String(payload.deviceId ?? "").trim();
    const fcmToken = String(payload.fcmToken ?? "").trim();
    const platform = payload.platform;

    if (!deviceId || !fcmToken) {
        throw badRequest("QUERY_INVALID");
    }
    if (platform !== "ios" && platform !== "android") {
        throw badRequest("QUERY_INVALID");
    }

    return {
        deviceId,
        fcmToken,
        platform,
        appVersion: normalizeOptional(payload.appVersion),
        locale: normalizeOptional(payload.locale),
    };
}

function normalizeOptional(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}
