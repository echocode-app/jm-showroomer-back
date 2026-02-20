import { toIsoString } from "../../utils/timestamp.js";

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.map(entry => ({
        ...entry,
        at: toIsoString(entry?.at),
    }));
}

export function normalizeShowroomForResponse(showroom) {
    if (!showroom || typeof showroom !== "object") return showroom;
    return {
        ...showroom,
        createdAt: toIsoString(showroom.createdAt),
        updatedAt: toIsoString(showroom.updatedAt),
        reviewedAt: toIsoString(showroom.reviewedAt),
        submittedAt: toIsoString(showroom.submittedAt),
        deletedAt: toIsoString(showroom.deletedAt),
        editHistory: normalizeHistory(showroom.editHistory),
    };
}
