import { Timestamp } from "firebase-admin/firestore";

// Purpose: Shared timestamp normalization.
// Responsibility: Convert Firestore/date-like values to stable ISO/Timestamp values.
// Invariant: invalid values return null instead of throwing.

export function toIsoString(value, { preserveInvalidString = true } = {}) {
    if (!value) return null;
    if (typeof value === "string") {
        const ms = Date.parse(value);
        if (Number.isFinite(ms)) return new Date(ms).toISOString();
        return preserveInvalidString ? value : null;
    }
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    return null;
}

export function toTimestamp(value) {
    if (!value) return null;
    if (value instanceof Timestamp) return value;
    if (value instanceof Date) return Timestamp.fromDate(value);
    if (typeof value?.toDate === "function") return Timestamp.fromDate(value.toDate());
    if (typeof value === "string") {
        const ms = Date.parse(value);
        if (!Number.isFinite(ms)) return null;
        return Timestamp.fromDate(new Date(ms));
    }
    return null;
}
