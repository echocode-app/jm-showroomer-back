// Value access + comparison utilities for ordering.

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
