import { FieldPath } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isIndexNotReadyError, buildDomainError } from "../showrooms/list/firestore/indexErrors.js";

export function getEventsCollection() {
    return getFirestoreInstance().collection("events");
}

export function buildPublicEventsBaseQuery({ nowTs, country, cityNormalized }) {
    let query = getEventsCollection()
        .where("published", "==", true)
        // Timestamp comparison is consistent with Firestore ordering and cursors.
        .where("startsAt", ">=", nowTs);

    if (country) query = query.where("country", "==", country);
    if (cityNormalized) query = query.where("cityNormalized", "==", cityNormalized);

    return query;
}

export function applyEventsOrdering(query) {
    // Keep deterministic order for stable cursor pagination.
    query = query.orderBy("startsAt", "asc");
    query = query.orderBy(FieldPath.documentId(), "asc");
    return query;
}

export function mapIndexError(err) {
    if (isIndexNotReadyError(err)) {
        throw buildDomainError("INDEX_NOT_READY");
    }
    throw err;
}
