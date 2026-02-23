import { created, ok } from "../utils/apiResponse.js";
import {
    createLookbookService,
    deleteLookbookService,
    getLookbookByIdCrudService,
    listLookbooksService,
    likeLookbookService,
    listLookbooksCrudService,
    unlikeLookbookService,
    updateLookbookService,
} from "../services/lookbooksService.js";
import { attachCoverUrl, attachSignedImages } from "../services/lookbooks/response.js";
import { attachAnonymousIdHeader, resolveActorIdentity } from "../utils/actorIdentity.js";
import { shouldEmitView } from "../services/analytics/viewThrottleService.js";
import { buildAnalyticsEvent } from "../services/analytics/analyticsEventBuilder.js";
import { record } from "../services/analytics/analyticsEventService.js";
import { ANALYTICS_EVENTS } from "../services/analytics/eventNames.js";
import { log } from "../config/logger.js";

export async function createLookbook(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        const lookbook = await createLookbookService(req.body ?? {}, actor);
        attachAnonymousIdHeader(res, actor);
        return created(res, { lookbook: { ...lookbook, likedByMe: false } });
    } catch (err) {
        next(err);
    }
}

export async function listLookbooks(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);

        // Backward-compatible mode for existing catalog endpoints.
        if (req.query?.country || req.query?.seasonKey) {
            const { lookbooks, meta } = await listLookbooksService(req.query ?? {});
            const withCover = await Promise.all(lookbooks.map(attachCoverUrl));
            attachAnonymousIdHeader(res, actor);
            return ok(res, { lookbooks: withCover }, meta);
        }

        const { lookbooks, meta } = await listLookbooksCrudService(req.query ?? {}, actor);
        attachAnonymousIdHeader(res, actor);
        return ok(res, { lookbooks }, meta);
    } catch (err) {
        next(err);
    }
}

export async function getLookbookById(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        const lookbook = await getLookbookByIdCrudService(req.params.id, actor);
        if (shouldEmitView(actor.actorId, "lookbook", lookbook.id)) {
            Promise.resolve().then(() =>
                record(buildAnalyticsEvent({
                    eventName: ANALYTICS_EVENTS.LOOKBOOK_VIEW,
                    source: "server",
                    actor,
                    context: {
                        surface: "lookbook_detail",
                    },
                    resource: {
                        type: "lookbook",
                        id: lookbook.id,
                        ownerUserId: lookbook.authorId ?? null,
                    },
                    meta: {
                        producer: "backend_api",
                    },
                }))
            ).catch(e => {
                log.error(`View analytics emit failed (lookbook_view ${lookbook.id}): ${e?.message || e}`);
            });
        }
        const signed = await attachSignedImages(lookbook);
        attachAnonymousIdHeader(res, actor);
        return ok(res, { lookbook: signed });
    } catch (err) {
        next(err);
    }
}

export async function favoriteLookbook(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        await likeLookbookService(req.params.id, actor);
        attachAnonymousIdHeader(res, actor);
        return ok(res, { lookbookId: req.params.id, status: "favorited" });
    } catch (err) {
        next(err);
    }
}

export async function unfavoriteLookbook(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        await unlikeLookbookService(req.params.id, actor);
        attachAnonymousIdHeader(res, actor);
        return ok(res, { lookbookId: req.params.id, status: "removed" });
    } catch (err) {
        next(err);
    }
}

export async function updateLookbook(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        const lookbook = await updateLookbookService(req.params.id, req.body ?? {}, actor);
        attachAnonymousIdHeader(res, actor);
        return ok(res, { lookbook });
    } catch (err) {
        next(err);
    }
}

export async function deleteLookbook(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        const result = await deleteLookbookService(req.params.id, actor);
        attachAnonymousIdHeader(res, actor);
        return ok(res, { lookbook: result });
    } catch (err) {
        next(err);
    }
}

export async function rsvpLookbook(req, res, next) {
    try {
        const { id } = req.params;
        return ok(res, { lookbookId: id, user: req.user.uid, status: "RSVPed" });
    } catch (err) {
        next(err);
    }
}
