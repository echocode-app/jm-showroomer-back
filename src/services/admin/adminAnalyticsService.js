// Admin analytics aggregation services (read-only).
// Design goal: use Firestore aggregate count() for cheap totals and keep document reads
// range-bounded when raw documents are unavoidable for time-series grouping or embedded history parsing.

import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest } from "../../core/error.js";
import { assertGroupBy, bucketStartIso, toDateOrNull } from "../../utils/dateGrouping.js";
import { ANALYTICS_EVENTS } from "../analytics/eventNames.js";

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

/**
 * Aggregates onboarding funnel/progress metrics from `users` collection.
 * Optionally returns a paged user list for admin progress tables.
 * @param {{includeUsers?: string|boolean, limit?: string|number, cursor?: string}} [filters]
 */
export async function getUsersOnboardingAnalyticsService(filters = {}) {
    const parsed = parseUsersOnboardingFilters(filters);
    const db = getFirestoreInstance();
    const users = db.collection("users");

    const [totalUsers, onboardingCompleted, ownerProfileCompleted] = await Promise.all([
        countQuery(users),
        countQuery(users.where("onboardingState", "==", "completed")),
        countQuery(users.where("role", "==", "owner")),
    ]);

    const onboardingNotCompleted = Math.max(0, totalUsers - onboardingCompleted);
    const ownerProfileNotCompleted = Math.max(0, onboardingCompleted - ownerProfileCompleted);

    const response = {
        funnel: {
            totalUsers,
            onboardingCompleted,
            onboardingNotCompleted,
            ownerProfileCompleted,
            ownerProfileNotCompleted,
        },
        journey: await getUsersOnboardingJourneyAnalytics(db, parsed),
    };

    if (!parsed.includeUsers) {
        return response;
    }

    let query = users.orderBy("__name__", "asc").limit(parsed.limit + 1);

    if (parsed.cursor) {
        query = query.startAfter(parsed.cursor);
    }

    const snap = await query.get();
    const docs = snap?.docs || [];
    const hasMore = docs.length > parsed.limit;
    const page = docs.slice(0, parsed.limit);

    response.users = page.map(doc => {
        const data = doc.data() || {};
        const onboardingState = String(data.onboardingState || "new");
        const role = String(data.role || "user");
        return {
            uid: data.uid || doc.id,
            email: data.email || null,
            name: data.name || null,
            role,
            onboardingState,
            ownerProfileCompleted: role === "owner",
            country: data.country || null,
            createdAt: toIsoOrNull(data.createdAt),
            updatedAt: toIsoOrNull(data.updatedAt),
        };
    });

    response.meta = {
        hasMore,
        nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
        limit: parsed.limit,
    };

    return response;
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

function parseUsersOnboardingFilters(filters = {}) {
    const includeRaw = filters?.includeUsers;
    const includeUsers =
        includeRaw === true ||
        includeRaw === "true" ||
        includeRaw === "1" ||
        includeRaw === 1;

    const limitRaw = filters?.limit;
    const limit = limitRaw === undefined ? 50 : Number(limitRaw);
    if (!Number.isFinite(limit) || limit < 1 || limit > 200) {
        throw badRequest("QUERY_INVALID");
    }

    const cursor = normalizeCursor(filters?.cursor);
    const to = filters?.to ? toDateOrNull(filters.to) : new Date();
    if (!to) throw badRequest("QUERY_INVALID");
    const from = filters?.from
        ? toDateOrNull(filters.from)
        : new Date(to.getTime() - MS_30_DAYS);
    if (!from) throw badRequest("QUERY_INVALID");
    if (from >= to) throw badRequest("QUERY_INVALID");
    return {
        includeUsers,
        limit: Math.trunc(limit),
        cursor,
        from,
        to,
    };
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

function normalizeCursor(cursor) {
    if (cursor === undefined || cursor === null) return null;
    const value = String(cursor).trim();
    if (!value) throw badRequest("QUERY_INVALID");
    return value;
}

function toIsoOrNull(value) {
    const date = toDateOrNull(value);
    return date ? date.toISOString() : null;
}

async function getUsersOnboardingJourneyAnalytics(db, parsed) {
    const fromIso = parsed.from.toISOString();
    const toIso = parsed.to.toISOString();
    const query = db
        .collection(ANALYTICS_COLLECTION)
        .where("timestamp", ">=", fromIso)
        .where("timestamp", "<", toIso);
    const snap = await query.get();

    const actorStageIndex = new Map();

    for (const doc of snap?.docs || []) {
        const data = doc.data() || {};
        const actorId = normalizeActorId(data?.user?.actorId);
        if (!actorId) continue;
        const stageIndex = resolveJourneyStageIndex(data);
        if (stageIndex === null) continue;
        const prev = actorStageIndex.get(actorId) ?? -1;
        if (stageIndex > prev) {
            actorStageIndex.set(actorId, stageIndex);
        }
    }

    const reached = new Array(JOURNEY_STAGES.length).fill(0);
    const dropoff = {
        splash: 0,
        onboardingStep1: 0,
        onboardingStep2: 0,
        onboardingStep3: 0,
        onboardingStep4: 0,
        auth: 0,
        ownerRegistration: 0,
    };

    for (const [, maxStageIndex] of actorStageIndex.entries()) {
        for (let i = 0; i <= maxStageIndex; i += 1) {
            reached[i] += 1;
        }

        if (maxStageIndex === STAGE_INDEX.splash) dropoff.splash += 1;
        if (maxStageIndex === STAGE_INDEX.onboardingStep1) dropoff.onboardingStep1 += 1;
        if (maxStageIndex === STAGE_INDEX.onboardingStep2) dropoff.onboardingStep2 += 1;
        if (maxStageIndex === STAGE_INDEX.onboardingStep3) dropoff.onboardingStep3 += 1;
        if (maxStageIndex === STAGE_INDEX.onboardingStep4) dropoff.onboardingStep4 += 1;
        if (maxStageIndex === STAGE_INDEX.auth) dropoff.auth += 1;
        if (maxStageIndex === STAGE_INDEX.ownerRegistration) dropoff.ownerRegistration += 1;
    }

    return {
        range: {
            from: fromIso,
            to: toIso,
        },
        totalActors: actorStageIndex.size,
        completedActors: reached[STAGE_INDEX.ownerRegistrationCompleted],
        stages: JOURNEY_STAGES.map((stage, index) => ({
            key: stage.key,
            reached: reached[index],
        })),
        dropoff,
    };
}

const JOURNEY_STAGES = [
    { key: "splash" },
    { key: "onboardingStep1" },
    { key: "onboardingStep2" },
    { key: "onboardingStep3" },
    { key: "onboardingStep4" },
    { key: "auth" },
    { key: "ownerRegistration" },
    { key: "ownerRegistrationCompleted" },
];

const STAGE_INDEX = {
    splash: 0,
    onboardingStep1: 1,
    onboardingStep2: 2,
    onboardingStep3: 3,
    onboardingStep4: 4,
    auth: 5,
    ownerRegistration: 6,
    ownerRegistrationCompleted: 7,
};

function resolveJourneyStageIndex(event) {
    const eventName = String(event?.eventName || "");
    if (eventName === ANALYTICS_EVENTS.SPLASH_VIEW) return STAGE_INDEX.splash;

    if (eventName === ANALYTICS_EVENTS.ONBOARDING_STEP_VIEW) {
        const step = parseOnboardingStep(event);
        if (step === 1) return STAGE_INDEX.onboardingStep1;
        if (step === 2) return STAGE_INDEX.onboardingStep2;
        if (step === 3) return STAGE_INDEX.onboardingStep3;
        if (step === 4) return STAGE_INDEX.onboardingStep4;
        return null;
    }

    if (
        eventName === ANALYTICS_EVENTS.AUTH_STARTED ||
        eventName === ANALYTICS_EVENTS.AUTH_COMPLETED ||
        eventName === ANALYTICS_EVENTS.AUTH_FAILED
    ) {
        return STAGE_INDEX.auth;
    }

    if (
        eventName === ANALYTICS_EVENTS.OWNER_REGISTRATION_VIEW ||
        eventName === ANALYTICS_EVENTS.OWNER_REGISTRATION_SUBMITTED
    ) {
        return STAGE_INDEX.ownerRegistration;
    }

    if (eventName === ANALYTICS_EVENTS.OWNER_REGISTRATION_COMPLETED) {
        return STAGE_INDEX.ownerRegistrationCompleted;
    }

    return null;
}

function parseOnboardingStep(event) {
    const contextStep = event?.context?.step;
    const attrStep = event?.resource?.attributes?.step;
    const value = contextStep ?? attrStep;
    const step = Number(value);
    if (!Number.isInteger(step)) return null;
    if (step < 1 || step > 4) return null;
    return step;
}

function normalizeActorId(actorId) {
    if (typeof actorId !== "string") return null;
    const normalized = actorId.trim();
    if (!normalized) return null;
    if (normalized === "a:unknown") return null;
    return normalized;
}
