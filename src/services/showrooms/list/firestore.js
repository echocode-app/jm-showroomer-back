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
    const baseQuery = buildBaseQuery(db.collection("showrooms"), parsed, user);
    const { orderField, direction } = getOrdering(parsed);
    const parsedWithUser = { ...parsed, user };

    try {
        if (parsed.geohashPrefixes.length > 0) {
            return await runGeohashMode(baseQuery, parsedWithUser, user, orderField, direction);
        }

        if (parsed.qName) {
            return await runNamePrefixMode(baseQuery, parsedWithUser);
        }

        return await runDefaultMode(baseQuery, parsedWithUser, orderField, direction, applyOrdering);
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY");
        }
        throw err;
    }
}

function applyOrdering(query, orderField, direction) {
    query = query.orderBy(orderField, direction);
    query = query.orderBy(FieldPath.documentId(), "asc");
    return query;
}
