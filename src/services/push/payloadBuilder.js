// Purpose: Normalize push payload into Firebase multicast shape.
// Responsibility: Ensure all payload fields are strings (FCM data contract).
// Invariant: outbound payload never contains undefined values.

export function buildMulticastPayload(tokens, payload) {
    return {
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
    };
}
