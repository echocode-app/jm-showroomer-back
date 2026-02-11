import { Timestamp } from "firebase-admin/firestore";

export function toIsoString(value) {
    // API contract exposes date-time fields as ISO strings.
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    return null;
}

export function toTimestamp(value) {
    // Accept mixed runtime types to keep reads/backfills tolerant.
    if (!value) return null;
    if (value instanceof Timestamp) return value;
    if (value instanceof Date) return Timestamp.fromDate(value);
    if (typeof value?.toDate === "function") return Timestamp.fromDate(value.toDate());
    if (typeof value === "string") {
        const ms = Date.parse(value);
        if (!Number.isFinite(ms)) return null;
        return Timestamp.fromDate(new Date(ms));
    }
    return null;
}

export function isEventPublished(event) {
    return event?.published === true || event?.status === "published";
}

export function isFutureEvent(event, nowTs) {
    const startsAt = toTimestamp(event?.startsAt);
    if (!startsAt) return false;
    return startsAt.toMillis() >= nowTs.toMillis();
}

export function compareByStartsAtAsc(a, b) {
    const left = toTimestamp(a.startsAt)?.toMillis() ?? 0;
    const right = toTimestamp(b.startsAt)?.toMillis() ?? 0;
    if (left < right) return -1;
    if (left > right) return 1;
    return String(a.id).localeCompare(String(b.id));
}

export function buildEventResponse(event, options = {}) {
    const wantIds = options.wantIds ?? null;
    const dismissedIds = options.dismissedIds ?? null;
    const includeDismissed = options.includeDismissed === true;

    const response = {
        ...event,
        // Normalize temporal fields to a stable API shape.
        startsAt: toIsoString(event.startsAt),
        endsAt: toIsoString(event.endsAt),
    };

    if (wantIds) {
        response.isWantToVisit = wantIds.has(event.id);
    }

    if (includeDismissed && dismissedIds) {
        response.isDismissed = dismissedIds.has(event.id);
    }

    return response;
}
