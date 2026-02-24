import { ok } from "../utils/apiResponse.js";
import { attachAnonymousIdHeader, resolveActorIdentity } from "../utils/actorIdentity.js";
import { buildAnalyticsEvent } from "../services/analytics/analyticsEventBuilder.js";
import { recordBatch } from "../services/analytics/analyticsEventService.js";
import { validateAnalyticsIngestPayload } from "../services/analytics/analyticsValidator.js";

export async function ingestAnalyticsEvents(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        const requestLogger = req?.log;
        const { events } = validateAnalyticsIngestPayload(req.body ?? {}, { logger: requestLogger });

        const accountState = resolveAccountState(req.user);
        const eventDrafts = events.map(item =>
            buildAnalyticsEvent({
                eventName: item.eventName,
                source: "client",
                actor: {
                    ...actor,
                    accountState,
                },
                context: item.context,
                resource: item.resource,
                meta: item.meta,
            })
        );

        const result = await recordBatch(eventDrafts, { logger: requestLogger });
        attachAnonymousIdHeader(res, actor);
        return ok(res, result);
    } catch (err) {
        next(err);
    }
}

function resolveAccountState(user) {
    if (!user) return "unknown";
    if (user.isDeleted === true) return "soft_deleted";
    if (user.deleteLock === true) return "delete_locked";
    return "active";
}
