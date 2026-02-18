// Value access + comparison utilities for ordering.

export function getValueByPath(obj, path) {
    if (!obj) return undefined;
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function toEpochMs(value) {
    if (!value) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toDate === "function") {
        const date = value.toDate();
        return date instanceof Date ? date.getTime() : null;
    }
    if (typeof value === "string") {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms : null;
    }
    return null;
}

export function normalizeComparableValue(value) {
    const epoch = toEpochMs(value);
    if (epoch !== null) return epoch;
    return value;
}

export function compareValues(a, b, direction = "asc") {
    const left = normalizeComparableValue(a);
    const right = normalizeComparableValue(b);

    if (left === right) return 0;
    if (left === undefined || left === null) return direction === "asc" ? -1 : 1;
    if (right === undefined || right === null) return direction === "asc" ? 1 : -1;
    if (left < right) return direction === "asc" ? -1 : 1;
    if (left > right) return direction === "asc" ? 1 : -1;
    return 0;
}
