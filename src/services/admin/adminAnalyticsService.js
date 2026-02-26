// Admin analytics aggregation services (read-only).
// Design goal: use Firestore aggregate count() for cheap totals and keep document reads
// range-bounded when raw documents are unavoidable for time-series grouping or embedded history parsing.

import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest } from "../../core/error.js";
import { assertGroupBy, bucketStartIso, toDateOrNull } from "../../utils/dateGrouping.js";

const ANALYTICS_COLLECTION = "analytics_events";
const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * Aggregates showroom analytics for admin dashboard/reporting pages.
 * Uses count() for created totals and a range-bounded read for moderation counts because
 * approve/reject actions live inside embedded `editHistory` arrays (not queryable by Firestore aggregate).
 * @param {{from?: string, to?: string, groupBy?: string}} [filters]
 */
export async function getShowroomsAnalyticsService(filters = {}) {
    const { from, to, groupBy } = parseRangeFilters(filters);
    const db = getFirestoreInstance();
    const showrooms = db.collection("showrooms");

    const createdQuery = withDateRange(showrooms, "createdAt", from, to);
    // Tradeoff: moderation events are embedded inside editHistory, so Firestore cannot aggregate them directly.
    // We bound the read by updatedAt>=from to avoid scanning the whole collection.
    const updatedSinceFromQuery = showrooms.where("updatedAt", ">=", from);

    const [totalCreatedInRange, createdSnap, updatedSnap] = await Promise.all([
        countQuery(createdQuery),
        createdQuery.get(),
        updatedSinceFromQuery.get(),
    ]);

    const createdSeries = buildTimeSeries(
        (createdSnap?.docs || []).map(doc => doc.data()?.createdAt),
        groupBy
    );

    let approveCount = 0;
    let rejectCount = 0;
    for (const doc of updatedSnap?.docs || []) {
        const data = doc.data() || {};
        const history = Array.isArray(data.editHistory) ? data.editHistory : [];
        for (const entry of history) {
            const action = String(entry?.action || "");
            if (action !== "approve" && action !== "reject") continue;
            const at = toDateOrNull(entry?.at);
            if (!at) continue;
            if (at < from || at >= to) continue;
            if (action === "approve") approveCount += 1;
            if (action === "reject") rejectCount += 1;
        }
    }

    return {
        range: {
            from: from.toISOString(),
            to: to.toISOString(),
            groupBy,
        },
        created: {
            total: totalCreatedInRange,
            series: createdSeries,
        },
        moderation: {
            approveCount,
            rejectCount,
        },
    };
}

/**
 * Aggregates event analytics for admin dashboard/reporting pages.
 * Uses aggregate count() for all summary metrics and a range-bounded createdAt read for bucket series.
 * @param {{from?: string, to?: string, groupBy?: string}} [filters]
 */
export async function getEventsAnalyticsService(filters = {}) {
    const { from, to, groupBy } = parseRangeFilters(filters);
    const db = getFirestoreInstance();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - MS_7_DAYS);
    const events = db.collection("events");

    const createdQuery = withDateRange(events, "createdAt", from, to);

    const [
        totalCreatedInRange,
        upcoming,
        past,
        newLast7Days,
        createdSnap,
    ] = await Promise.all([
        countQuery(createdQuery),
        countQuery(events.where("startsAt", ">=", now)),
        countQuery(events.where("startsAt", "<", now)),
        countQuery(events.where("createdAt", ">=", sevenDaysAgo)),
        createdQuery.get(),
    ]);

    return {
        range: {
            from: from.toISOString(),
            to: to.toISOString(),
            groupBy,
        },
        created: {
            total: totalCreatedInRange,
            series: buildTimeSeries(
                (createdSnap?.docs || []).map(doc => doc.data()?.createdAt),
                groupBy
            ),
        },
        summary: {
            upcoming,
            past,
            newLast7Days,
        },
    };
}

/**
 * Aggregates ingested platform analytics events for admin dashboard/reporting pages.
 * Totals use aggregate count(); event-name histogram and timeline require a range-bounded read.
 * @param {{from?: string, to?: string, groupBy?: string}} [filters]
 */
export async function getPlatformAnalyticsService(filters = {}) {
    const { from, to, groupBy } = parseRangeFilters(filters);
    const db = getFirestoreInstance();
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    // `timestamp` is stored as ISO string in analytics_events; lexicographic range matches chronological order.
    const query = db
        .collection(ANALYTICS_COLLECTION)
        .where("timestamp", ">=", fromIso)
        .where("timestamp", "<", toIso);

    const [total, snap] = await Promise.all([countQuery(query), query.get()]);

    const byEventNameMap = new Map();
    const timelineDates = [];

    for (const doc of snap?.docs || []) {
        const data = doc.data() || {};
        const eventName = String(data.eventName || "unknown");
        byEventNameMap.set(eventName, (byEventNameMap.get(eventName) || 0) + 1);
        timelineDates.push(data.timestamp ?? null);
    }

    const byEventName = Array.from(byEventNameMap.entries())
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((a, b) => b.count - a.count || a.eventName.localeCompare(b.eventName));

    return {
        range: {
            from: fromIso,
            to: toIso,
            groupBy,
        },
        total,
        timeline: buildTimeSeries(timelineDates, groupBy),
        byEventName,
    };
}

// Shared query parsing for admin analytics endpoints.
// Kept local to preserve consistent QUERY_INVALID behavior without changing endpoint contracts.
function parseRangeFilters(filters = {}) {
    let groupBy;
    try {
        groupBy = assertGroupBy(filters?.groupBy || "day");
    } catch {
        throw badRequest("QUERY_INVALID");
    }

    const to = filters?.to ? toDateOrNull(filters.to) : new Date();
    if (!to) throw badRequest("QUERY_INVALID");

    const from = filters?.from
        ? toDateOrNull(filters.from)
        : new Date(to.getTime() - MS_30_DAYS);
    if (!from) throw badRequest("QUERY_INVALID");
    if (from >= to) throw badRequest("QUERY_INVALID");

    return { from, to, groupBy };
}

function withDateRange(collectionRef, field, from, to) {
    return collectionRef.where(field, ">=", from).where(field, "<", to);
}

async function countQuery(query) {
    const snap = await query.count().get();
    return Number(snap?.data?.().count || 0);
}

// Buckets are sorted lexicographically because they are normalized ISO UTC timestamps.
function buildTimeSeries(values, groupBy) {
    const map = new Map();
    for (const value of values || []) {
        const bucket = bucketStartIso(value, groupBy);
        if (!bucket) continue;
        map.set(bucket, (map.get(bucket) || 0) + 1);
    }
    return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([bucket, count]) => ({ bucket, count }));
}
