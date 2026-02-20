import { Timestamp } from "firebase-admin/firestore";
import { toIsoString, toTimestamp } from "../../utils/timestamp.js";

// Re-export for existing imports in events domain.
export { toIsoString, toTimestamp };

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
