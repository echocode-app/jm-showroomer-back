import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isIndexNotReadyError, buildDomainError } from "../showrooms/list/firestore/indexErrors.js";

export function getLookbooksCollection() {
    return getFirestoreInstance().collection("lookbooks");
}

export function buildPublicLookbooksBaseQuery({ countryNormalized, seasonKey }) {
    return getLookbooksCollection()
        .where("published", "==", true)
        .where("countryNormalized", "==", countryNormalized)
        .where("seasonKey", "==", seasonKey);
}

export function applyRankOrdering(query) {
    return query
        .orderBy("sortRank", "asc")
        .orderBy(FieldPath.documentId(), "asc");
}

export function applyPublishedOrdering(query) {
    return query
        .orderBy("publishedAt", "desc")
        .orderBy(FieldPath.documentId(), "asc");
}

export function mapIndexError(err) {
    if (isIndexNotReadyError(err)) {
        throw buildDomainError("INDEX_NOT_READY");
    }
    throw err;
}

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
