// Firestore helpers for showroom counter service.

import { buildBaseQuery } from "../list/firestore/baseQuery.js";
import { countWithBlockedFilter } from "./helpers.js";

/**
 * Executes one prefix-aware counter query in Firestore.
 */
export async function countForPrefix(db, parsed, user, prefix) {
    let query = buildBaseQuery(db.collection("showrooms"), parsed, user);

    if (prefix) {
        // Geohash prefix range emulates map bounding buckets.
        query = query
            .where("geo.geohash", ">=", prefix)
            .where("geo.geohash", "<=", `${prefix}\uf8ff`)
            .orderBy("geo.geohash", "asc");
    }

    if (parsed.qName) {
        // Optional name prefix counter path (mutually exclusive with geohash in parser).
        query = query
            .where("nameNormalized", ">=", parsed.qName)
            .where("nameNormalized", "<=", `${parsed.qName}\uf8ff`)
            .orderBy("nameNormalized", "asc");
    }

    return await countWithBlockedFilter(query, parsed);
}
