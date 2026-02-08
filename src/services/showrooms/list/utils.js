// Showroom list utils helpers.

// Showroom list shared utilities.
import { encodeCursor } from "./parse.js";

export function getValueByPath(obj, path) {
    if (!obj) return undefined;
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export function compareValues(a, b, direction = "asc") {
    if (a === b) return 0;
    if (a === undefined || a === null) return direction === "asc" ? -1 : 1;
    if (b === undefined || b === null) return direction === "asc" ? 1 : -1;
    if (a < b) return direction === "asc" ? -1 : 1;
    if (a > b) return direction === "asc" ? 1 : -1;
    return 0;
}

export function applyFieldMode(showroom, mode) {
    if (mode !== "marker") return showroom;
    return {
        id: showroom.id,
        name: showroom.name ?? null,
        type: showroom.type ?? null,
        category: showroom.category ?? null,
        geo: showroom.geo?.coords ? { coords: showroom.geo.coords } : null,
    };
}

export function applyCursorFilter(items, cursor, orderField, direction) {
    if (!cursor) return items;
    return items.filter(item => {
        const value = getValueByPath(item, orderField);
        const cmp = compareValues(value, cursor.value, direction);
        if (cmp === 0) {
            return item.id > cursor.id;
        }
        return cmp > 0;
    });
}

export function buildMeta(items, limit, orderField, direction) {
    const hasMore = items.length > limit;
    const pageItems = items.slice(0, limit);
    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
        const last = pageItems[pageItems.length - 1];
        nextCursor = encodeCursor({
            value: getValueByPath(last, orderField),
            id: last.id,
            dir: direction,
        });
    }
    return { pageItems, meta: { nextCursor, hasMore } };
}

export function getVisibilityFilter(user, statusFilter) {
    if (!user) return { type: "guest" };
    if (user.role === "owner") return { type: "owner", status: statusFilter };
    if (user.role === "admin") return { type: "admin", status: statusFilter };
    return { type: "guest" };
}

export function mergeSnapshots(snapshots) {
    const map = new Map();
    snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if (!map.has(doc.id)) {
                map.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    });
    return Array.from(map.values());
}

export function applyVisibilityPostFilter(items, user) {
    if (!user || user.role === "owner") {
        return items.filter(s => s.status !== "deleted");
    }
    return items;
}
