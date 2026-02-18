import { Timestamp } from "firebase-admin/firestore";

function toIsoString(value) {
    if (!value) return null;
    if (typeof value === "string") {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? new Date(ms).toISOString() : value;
    }
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    return null;
}

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
