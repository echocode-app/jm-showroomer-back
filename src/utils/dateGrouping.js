// UTC date-bucket helpers shared by admin analytics endpoints.
// Purpose: keep grouping semantics deterministic across Firestore Timestamp / ISO / Date inputs.

const GROUP_BY_VALUES = new Set(["day", "week", "month"]);

/**
 * Validates and normalizes supported analytics grouping granularity.
 * @param {string} groupBy
 * @returns {"day"|"week"|"month"}
 */
export function assertGroupBy(groupBy) {
    const value = String(groupBy || "day").trim().toLowerCase();
    if (!GROUP_BY_VALUES.has(value)) {
        throw new Error(`Unsupported groupBy: ${groupBy}`);
    }
    return value;
}

/**
 * Converts Date / ISO string / Firestore Timestamp-like object into a JS Date.
 * Returns null for invalid/unsupported inputs instead of throwing.
 * @param {unknown} value
 * @returns {Date|null}
 */
export function toDateOrNull(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value?.toDate === "function") {
        const d = value.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normalizes a timestamp to the start of its UTC bucket and returns ISO string.
 * Week buckets use Monday as the first day to match dashboard reporting expectations.
 * @param {unknown} value
 * @param {"day"|"week"|"month"} [groupBy="day"]
 * @returns {string|null}
 */
export function bucketStartIso(value, groupBy = "day") {
    const date = toDateOrNull(value);
    if (!date) return null;
    const normalizedGroupBy = assertGroupBy(groupBy);
    const d = new Date(date.getTime());
    d.setUTCHours(0, 0, 0, 0);

    if (normalizedGroupBy === "week") {
        const day = d.getUTCDay(); // 0=Sun ... 6=Sat
        const offsetToMonday = (day + 6) % 7;
        d.setUTCDate(d.getUTCDate() - offsetToMonday);
    } else if (normalizedGroupBy === "month") {
        d.setUTCDate(1);
    }

    return d.toISOString();
}
