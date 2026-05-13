import isEqual from "lodash.isequal";
import { isSameCountryValue } from "../../constants/countries.js";
import { EDITABLE_FIELDS, HISTORY_LIMIT } from "./_constants.js";

// isSameCountry
export function isSameCountry(left, right) {
    return isSameCountryValue(left, right);
}

// buildDiff
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

// makeHistoryEntry
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

// appendHistory
export function appendHistory(history = [], entry) {
    const next = [...history, entry];
    if (next.length <= HISTORY_LIMIT) return next;
    return next.slice(-HISTORY_LIMIT);
}

// buildPendingSnapshot
export function buildPendingSnapshot(showroom, overrides = {}) {
    const snapshot = {};
    for (const field of EDITABLE_FIELDS) {
        if (showroom[field] !== undefined) {
            snapshot[field] = showroom[field];
        }
    }
    return { ...snapshot, ...overrides };
}

export function hasPriorHistoryAction(history = [], action) {
    return history.some(entry => entry?.action === action);
}

export function buildModerationNotificationDedupeKey(showroom, showroomId, action, historyAction = action) {
    const baseKey = `showroom:${showroomId}:${action}`;
    if (!hasPriorHistoryAction(showroom?.editHistory || [], historyAction)) {
        return baseKey;
    }

    const cycleKey = toCycleKey(showroom?.submittedAt);
    if (!cycleKey) {
        return baseKey;
    }

    return `${baseKey}:${cycleKey}`;
}

function toCycleKey(value) {
    if (!value) return null;

    if (typeof value === "string") {
        return value.replace(/[^\dTZ]/g, "");
    }

    if (typeof value?.toDate === "function") {
        return value.toDate().toISOString().replace(/[^\dTZ]/g, "");
    }

    if (typeof value?._seconds === "number") {
        const millis = value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
        return new Date(millis).toISOString().replace(/[^\dTZ]/g, "");
    }

    return null;
}
