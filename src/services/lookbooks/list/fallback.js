import { getLookbooksCollection } from "../firestoreQuery.js";
import { normalizeLookbook } from "../response.js";

export async function fetchWithInMemoryFallback(parsed, limit) {
    const snap = await getLookbooksCollection()
        .where("published", "==", true)
        .get();

    const filtered = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .map(normalizeLookbook)
        .filter(item => item.countryNormalized === parsed.countryNormalized)
        .filter(item => item.seasonKey === parsed.seasonKey);

    // Mirror production ordering in fallback mode to preserve cursor behavior.
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
