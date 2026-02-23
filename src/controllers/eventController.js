import { fail, ok } from "../utils/apiResponse.js";
import {
    dismissEventService,
    getEventByIdService,
    listEventsService,
    markEventWantToVisitService,
    removeEventWantToVisitService,
    undismissEventService,
} from "../services/eventsService.js";
import { attachAnonymousIdHeader, resolveActorIdentity } from "../utils/actorIdentity.js";
import { shouldEmitView } from "../services/analytics/viewThrottleService.js";
import { buildAnalyticsEvent } from "../services/analytics/analyticsEventBuilder.js";
import { record } from "../services/analytics/analyticsEventService.js";
import { ANALYTICS_EVENTS } from "../services/analytics/eventNames.js";
import { log } from "../config/logger.js";

export async function listEvents(req, res, next) {
    try {
        // Optional auth enriches response with user-specific state without requiring login.
        const user = req.user ? { uid: req.auth?.uid ?? req.user?.uid } : null;
        const { events, meta } = await listEventsService(req.query ?? {}, user);
        return ok(res, { events }, meta);
    } catch (err) {
        next(err);
    }
}

export async function getEventById(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        // Optional auth adds isWantToVisit/isDismissed fields for the current user.
        const user = req.user ? { uid: req.auth?.uid ?? req.user?.uid } : null;
        const event = await getEventByIdService(req.params.id, user);
        if (shouldEmitView(actor.actorId, "event", event.id)) {
            record(buildAnalyticsEvent({
                eventName: ANALYTICS_EVENTS.EVENT_VIEW,
                source: "server",
                actor,
                context: {
                    surface: "event_detail",
                },
                resource: {
                    type: "event",
                    id: event.id,
                    ownerUserId: event.ownerUid ?? null,
                },
                meta: {
                    producer: "backend_api",
                },
            })).catch(e => {
                log.error(`View analytics emit failed (event_view ${event.id}): ${e?.message || e}`);
            });
        }
        attachAnonymousIdHeader(res, actor);
        return ok(res, { event });
    } catch (err) {
        next(err);
    }
}

export async function markWantToVisit(req, res, next) {
    try {
        await markEventWantToVisitService(req.params.id, req.auth.uid);
        return ok(res, { eventId: req.params.id, status: "want_to_visit" });
    } catch (err) {
        next(err);
    }
}

export async function removeWantToVisit(req, res, next) {
    try {
        await removeEventWantToVisitService(req.params.id, req.auth.uid);
        return ok(res, { eventId: req.params.id, status: "removed" });
    } catch (err) {
        next(err);
    }
}

export async function dismissEvent(req, res, next) {
    try {
        await dismissEventService(req.params.id, req.auth.uid);
        return ok(res, { eventId: req.params.id, status: "dismissed" });
    } catch (err) {
        next(err);
    }
}

export async function undismissEvent(req, res, next) {
    try {
        await undismissEventService(req.params.id, req.auth.uid);
        return ok(res, { eventId: req.params.id, status: "restored" });
    } catch (err) {
        next(err);
    }
}

// rsvpEvent
export async function rsvpEvent(req, res) {
    return fail(res, "EVENTS_WRITE_MVP2_ONLY", "Events write endpoints are MVP2 only", 501);
}
