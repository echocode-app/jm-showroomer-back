import isEqual from "lodash.isequal";
import { EDITABLE_FIELDS, HISTORY_LIMIT } from "./_constants.js";

export function isSameCountry(left, right) {
    if (!left || !right) return false;
    return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

export function buildDiff(before = {}, after = {}, fields = EDITABLE_FIELDS) {
    const diff = {};
    const changedFields = [];

    for (const field of fields) {
        if (!isEqual(before[field], after[field])) {
            diff[field] = {
                from: before[field] === undefined ? null : before[field],
                to: after[field] === undefined ? null : after[field],
            };
            changedFields.push(field);
        }
    }

    return { diff, changedFields };
}

export function makeHistoryEntry({
    action,
    actor,
    statusBefore,
    statusAfter,
    changedFields = [],
    diff = {},
    at = new Date().toISOString(),
}) {
    return {
        action,
        at,
        actor: {
            uid: actor?.uid ?? null,
            role: actor?.role ?? null,
        },
        statusBefore: statusBefore ?? null,
        statusAfter: statusAfter ?? null,
        changedFields,
        diff,
    };
}

export function appendHistory(history = [], entry) {
    const next = [...history, entry];
    if (next.length <= HISTORY_LIMIT) return next;
    return next.slice(-HISTORY_LIMIT);
}

export function buildPendingSnapshot(showroom, overrides = {}) {
    const snapshot = {};
    for (const field of EDITABLE_FIELDS) {
        if (showroom[field] !== undefined) {
            snapshot[field] = showroom[field];
        }
    }
    return { ...snapshot, ...overrides };
}
