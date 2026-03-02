// Shared ordering/cursor helpers for lookbooks list modes.

export function compareLookbooks(a, b) {
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

export function compareToCursor(item, cursor) {
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

export function buildCursorFromItem(item) {
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
