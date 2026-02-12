// Firestore-mode suggestion fetchers.

import { FieldPath } from "firebase-admin/firestore";
import { isCountryBlocked } from "../../../constants/countries.js";
import { applyVisibilityPostFilter } from "../list/utils/visibility.js";
import { SHOWROOM_SUGGEST_LIMIT } from "./constants.js";
import {
    buildBrandSuggestions,
    buildCitySuggestions,
    toShowroomSuggestion,
} from "./builders.js";

/**
 * Returns showroom-name suggestions with strict prefix matching.
 */
export async function fetchShowroomSuggestions(baseQuery, parsed, user) {
    // Cap showroom suggestions so city/brand hints still have room in combined response.
    const limit = Math.min(parsed.limit, SHOWROOM_SUGGEST_LIMIT);
    const query = baseQuery
        .where("nameNormalized", ">=", parsed.qName)
        .where("nameNormalized", "<=", `${parsed.qName}\uf8ff`)
        .orderBy("nameNormalized", "asc")
        .orderBy(FieldPath.documentId(), "asc")
        .limit(limit);

    const snapshot = await query.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    items = applyVisibilityPostFilter(items, user);
    items = items.filter(s => !isCountryBlocked(s.country));
    return items.map(toShowroomSuggestion);
}

/**
 * Returns city suggestions sampled from the current filtered dataset.
 */
export async function fetchCitySuggestions(baseQuery, parsed, user, sampleLimit) {
    const sample = await fetchSampleShowrooms(baseQuery, parsed, user, sampleLimit);
    return buildCitySuggestions(sample, parsed);
}

/**
 * Returns brand suggestions sampled from the current filtered dataset.
 */
export async function fetchBrandSuggestions(baseQuery, parsed, user, sampleLimit) {
    const sample = await fetchSampleShowrooms(baseQuery, parsed, user, sampleLimit);
    return buildBrandSuggestions(sample, parsed);
}

/**
 * Loads a bounded sample that is used by city/brand suggestion builders.
 */
async function fetchSampleShowrooms(baseQuery, parsed, user, sampleLimit) {
    if (parsed.geohashPrefixes.length === 0) {
        // Non-geo mode: take first N records in deterministic name order.
        const query = baseQuery
            .orderBy("nameNormalized", "asc")
            .orderBy(FieldPath.documentId(), "asc")
            .limit(sampleLimit);

        const snapshot = await query.get();
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        items = applyVisibilityPostFilter(items, user);
        return items.filter(s => !isCountryBlocked(s.country));
    }

    const perPrefix = Math.max(1, Math.ceil(sampleLimit / parsed.geohashPrefixes.length));
    // Geo mode: sample each prefix separately, then merge and post-filter in memory.
    const snapshots = await Promise.all(
        parsed.geohashPrefixes.map(prefix =>
            baseQuery
                .where("geo.geohash", ">=", prefix)
                .where("geo.geohash", "<=", `${prefix}\uf8ff`)
                .orderBy("geo.geohash", "asc")
                .orderBy(FieldPath.documentId(), "asc")
                .limit(perPrefix)
                .get()
        )
    );

    let items = snapshots.flatMap(snapshot =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    );
    items = applyVisibilityPostFilter(items, user);
    return items.filter(s => !isCountryBlocked(s.country));
}
