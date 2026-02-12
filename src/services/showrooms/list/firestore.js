// Firestore list entrypoint orchestrating list modes.

import { getFirestoreInstance } from "../../../config/firebase.js";
import { getOrdering } from "./ordering.js";
import { buildBaseQuery } from "./firestore/baseQuery.js";
import { runGeohashMode } from "./firestore/geohashMode.js";
import { runNamePrefixMode } from "./firestore/namePrefixMode.js";
import { runDefaultMode } from "./firestore/defaultMode.js";
import { isIndexNotReadyError, buildDomainError } from "./firestore/indexErrors.js";
import { FieldPath } from "firebase-admin/firestore";

export async function listShowroomsFirestore(parsed, user) {
    const db = getFirestoreInstance();
    // Build one shared baseline query (visibility + exact filters).
    const baseQuery = buildBaseQuery(db.collection("showrooms"), parsed, user);
    // Ordering is resolved once to keep cursor and mode behavior deterministic.
    const { orderField, direction } = getOrdering(parsed);
    const parsedWithUser = { ...parsed, user };

    try {
        // Geohash mode is map-oriented: potentially multiple prefix scans + in-memory merge.
        if (parsed.geohashPrefixes.length > 0) {
            return await runGeohashMode(baseQuery, parsedWithUser, user, orderField, direction);
        }

        // Name prefix mode uses Firestore range query over normalized showroom names.
        if (parsed.qName) {
            return await runNamePrefixMode(baseQuery, parsedWithUser);
        }

        // Default mode = standard filtered feed with server cursor pagination.
        return await runDefaultMode(baseQuery, parsedWithUser, orderField, direction, applyOrdering);
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY");
        }
        throw err;
    }
}

function applyOrdering(query, orderField, direction) {
    // Secondary sort by document id guarantees stable ordering for equal primary values.
    query = query.orderBy(orderField, direction);
    query = query.orderBy(FieldPath.documentId(), "asc");
    return query;
}
