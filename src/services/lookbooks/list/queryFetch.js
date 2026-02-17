import {
    applyPublishedOrdering,
    applyRankOrdering,
    buildPublicLookbooksBaseQuery,
    mapIndexError,
} from "../firestoreQuery.js";
import { normalizeLookbook } from "../response.js";

// Fetch ranked segment (`sortRank != null`) with deterministic cursor progression.
export async function fetchRanked(parsed, limit) {
    if (limit <= 0) return [];
    if (parsed.cursor?.mode === "published") return [];

    let query = buildPublicLookbooksBaseQuery(parsed)
        .where("sortRank", "!=", null);

    query = applyRankOrdering(query);

    if (parsed.cursor?.mode === "rank") {
        query = query.startAfter(parsed.cursor.sortRank, parsed.cursor.id);
    }

    query = query.limit(limit);

    try {
        const snap = await query.get();
        return snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .map(normalizeLookbook)
            .filter(item => Number.isFinite(item.sortRank))
            .map(item => ({
                payload: item,
                cursor: {
                    mode: "rank",
                    sortRank: item.sortRank,
                    id: item.id,
                },
            }));
    } catch (err) {
        mapIndexError(err);
    }
}

// Fetch unranked segment (`sortRank == null`) ordered by publication time.
export async function fetchUnranked(parsed, limit) {
    if (limit <= 0) return [];

    let query = buildPublicLookbooksBaseQuery(parsed)
        .where("sortRank", "==", null);

    query = applyPublishedOrdering(query);

    if (parsed.cursor?.mode === "published") {
        query = query.startAfter(parsed.cursor.publishedAtTs, parsed.cursor.id);
    }

    query = query.limit(limit);

    try {
        const snap = await query.get();
        return snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .map(normalizeLookbook)
            .map(item => ({
                payload: item,
                cursor: {
                    mode: "published",
                    publishedAtIso: item.publishedAt,
                    id: item.id,
                },
            }));
    } catch (err) {
        mapIndexError(err);
    }
}
