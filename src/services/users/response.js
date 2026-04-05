import { toIsoString } from "../../utils/timestamp.js";

export function normalizeUserForResponse(userDoc) {
    if (!userDoc || typeof userDoc !== "object") return userDoc;

    const normalized = {
        ...userDoc,
        createdAt: toIsoString(userDoc.createdAt),
        updatedAt: toIsoString(userDoc.updatedAt),
        deletedAt: toIsoString(userDoc.deletedAt),
        deleteLockAt: toIsoString(userDoc.deleteLockAt),
    };

    if (userDoc.roleRequest && typeof userDoc.roleRequest === "object") {
        normalized.roleRequest = {
            ...userDoc.roleRequest,
            requestedAt: toIsoString(userDoc.roleRequest.requestedAt),
            reviewedAt: toIsoString(userDoc.roleRequest.reviewedAt),
        };
    }

    return normalized;
}
