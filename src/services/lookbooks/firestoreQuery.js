import { FieldPath } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isIndexNotReadyError, buildDomainError } from "../showrooms/list/firestore/indexErrors.js";
import { toIsoString, toTimestamp } from "../../utils/timestamp.js";

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

export { toIsoString, toTimestamp };
