import {
    applyPublishedOrdering,
    applyRankOrdering,
    buildPublicLookbooksBaseQuery,
    getLookbooksCollection,
    mapIndexError,
} from "./firestoreQuery.js";
import { encodeListCursor, parseLookbookListFilters } from "./parse.js";
import { normalizeLookbook } from "./response.js";

export async function listLookbooksService(filters = {}) {
    const parsed = parseLookbookListFilters(filters);
    const maxItems = parsed.limit + 1;

    let items;
    try {
        const ranked = await fetchRanked(parsed, maxItems);
        items = ranked.length >= maxItems
            ? ranked.slice(0, maxItems)
            : ranked.concat(await fetchUnranked(parsed, maxItems - ranked.length));
    } catch (err) {
        if (!shouldUseFallback(err)) {
            throw err;
        }
        items = await fetchWithInMemoryFallback(parsed, maxItems);
    }

    const hasMore = items.length > parsed.limit;
    const pageItems = items.slice(0, parsed.limit);
    const last = pageItems[pageItems.length - 1] ?? null;

    const nextCursor = hasMore && last
        ? encodeListCursor(last.cursor)
        : null;

    return {
        lookbooks: pageItems.map(item => item.payload),
        meta: {
            hasMore,
            nextCursor,
            paging: hasMore ? "enabled" : "end",
        },
    };
}

async function fetchRanked(parsed, limit) {
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

async function fetchUnranked(parsed, limit) {
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

async function fetchWithInMemoryFallback(parsed, limit) {
    const snap = await getLookbooksCollection()
        .where("published", "==", true)
        .get();

    const filtered = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .map(normalizeLookbook)
        .filter(item => item.countryNormalized === parsed.countryNormalized)
        .filter(item => item.seasonKey === parsed.seasonKey);

    filtered.sort(compareLookbooks);

    const afterCursor = parsed.cursor
        ? filtered.filter(item => compareToCursor(item, parsed.cursor) > 0)
        : filtered;

    return afterCursor.slice(0, limit).map(item => ({
        payload: item,
        cursor: buildCursorFromItem(item),
    }));
}

function compareLookbooks(a, b) {
    const aRanked = Number.isFinite(a.sortRank);
    const bRanked = Number.isFinite(b.sortRank);

    if (aRanked && bRanked) {
        if (a.sortRank < b.sortRank) return -1;
        if (a.sortRank > b.sortRank) return 1;
        return String(a.id).localeCompare(String(b.id));
    }

    if (aRanked) return -1;
    if (bRanked) return 1;

    const aTs = Date.parse(a.publishedAt ?? a.updatedAt ?? a.createdAt ?? "");
    const bTs = Date.parse(b.publishedAt ?? b.updatedAt ?? b.createdAt ?? "");
    const aMs = Number.isFinite(aTs) ? aTs : 0;
    const bMs = Number.isFinite(bTs) ? bTs : 0;
    if (aMs > bMs) return -1;
    if (aMs < bMs) return 1;
    return String(a.id).localeCompare(String(b.id));
}

function compareToCursor(item, cursor) {
    if (cursor.mode === "rank") {
        if (!Number.isFinite(item.sortRank)) return 1;
        if (item.sortRank < cursor.sortRank) return -1;
        if (item.sortRank > cursor.sortRank) return 1;
        return String(item.id).localeCompare(String(cursor.id));
    }

    if (Number.isFinite(item.sortRank)) return -1;
    const itemMs = Date.parse(item.publishedAt ?? item.updatedAt ?? item.createdAt ?? "");
    const cursorMs = Date.parse(cursor.publishedAtIso ?? "");
    const safeItemMs = Number.isFinite(itemMs) ? itemMs : 0;
    const safeCursorMs = Number.isFinite(cursorMs) ? cursorMs : 0;

    // publishedAt desc ordering: newer items are before the cursor.
    if (safeItemMs > safeCursorMs) return -1;
    if (safeItemMs < safeCursorMs) return 1;
    return String(item.id).localeCompare(String(cursor.id));
}

function buildCursorFromItem(item) {
    if (Number.isFinite(item.sortRank)) {
        return {
            mode: "rank",
            sortRank: item.sortRank,
            id: item.id,
        };
    }

    return {
        mode: "published",
        publishedAtIso: item.publishedAt,
        id: item.id,
    };
}

function shouldUseFallback(err) {
    return err?.code === "INDEX_NOT_READY" && process.env.NODE_ENV !== "prod";
}
