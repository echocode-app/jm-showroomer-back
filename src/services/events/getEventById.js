import { isCountryBlocked } from "../../constants/countries.js";
import { notFound } from "../../core/error.js";
import { buildEventResponse, isEventPublished } from "./eventResponse.js";
import { getEventsCollection } from "./firestoreQuery.js";
import { getUserEventIds } from "./userEventState.js";

export async function getEventById(id, user = null) {
    const snap = await getEventsCollection().doc(id).get();
    const event = snap.exists ? { id: snap.id, ...snap.data() } : null;

    if (!event || !isEventPublished(event) || isCountryBlocked(event.country)) {
        throw notFound("EVENT_NOT_FOUND");
    }

    const uid = user?.uid ?? null;
    // Public endpoint: user state is only attached when auth context exists.
    if (!uid) return buildEventResponse(event);

    const [dismissedIds, wantIds] = await Promise.all([
        getUserEventIds(uid, "events_dismissed"),
        getUserEventIds(uid, "events_want_to_visit"),
    ]);

    return buildEventResponse(event, {
        wantIds,
        includeDismissed: true,
        dismissedIds,
    });
}
