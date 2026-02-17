import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isIndexNotReadyError, buildDomainError } from "../showrooms/list/firestore/indexErrors.js";

// Single source of truth for lookbooks collection reference.
export function getLookbooksCollection() {
    return getFirestoreInstance().collection("lookbooks");
}

// Shared public base filter used by ranked/unranked list queries.
export function buildPublicLookbooksBaseQuery({ countryNormalized, seasonKey }) {
    return getLookbooksCollection()
        .where("published", "==", true)
        .where("countryNormalized", "==", countryNormalized)
        .where("seasonKey", "==", seasonKey);
}

// Ranked segment ordering: manual rank first, deterministic id tie-breaker.
export function applyRankOrdering(query) {
    return query
        .orderBy("sortRank", "asc")
        .orderBy(FieldPath.documentId(), "asc");
}

// Published segment ordering for unranked records.
export function applyPublishedOrdering(query) {
    return query
        .orderBy("publishedAt", "desc")
        .orderBy(FieldPath.documentId(), "asc");
}

// Map Firestore index errors to stable API-level domain errors.
export function mapIndexError(err) {
    if (isIndexNotReadyError(err)) {
        throw buildDomainError("INDEX_NOT_READY");
    }
    throw err;
}

// Normalize Firestore/date-like values into ISO string for API responses.
export function toIsoString(value) {
    if (!value) return null;
    if (typeof value === "string") {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value?.toDate === "function") {
        return value.toDate().toISOString();
    }
    return null;
}

// Normalize Firestore/date-like values into Timestamp for query cursors.
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
