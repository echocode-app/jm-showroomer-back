import {
    createShowroom,
    createDraftShowroom,
    submitShowroomForReviewService,
    listShowroomsService,
    suggestShowroomsService,
    countShowroomsService,
    getShowroomByIdService,
    favoriteShowroomService,
    unfavoriteShowroomService,
    updateShowroomService,
    deleteShowroomService,
} from "../services/showroomService.js";
import { ok } from "../utils/apiResponse.js";
import { attachAnonymousIdHeader, resolveActorIdentity } from "../utils/actorIdentity.js";
import { shouldEmitView } from "../services/analytics/viewThrottleService.js";
import { buildAnalyticsEvent } from "../services/analytics/analyticsEventBuilder.js";
import { record } from "../services/analytics/analyticsEventService.js";
import { ANALYTICS_EVENTS } from "../services/analytics/eventNames.js";
import { log } from "../config/logger.js";
import { logDomainEvent } from "../utils/logDomainEvent.js";
import { classifyError } from "../utils/errorClassifier.js";

function logShowroomCreateFailure(req, err) {
    const { level } = classifyError(err);
    logDomainEvent(req, {
        domain: "showroom",
        event: "create",
        status: "failed",
        meta: {
            code: err?.code || "INTERNAL_ERROR",
        },
    }, level);
}

function logShowroomSubmitFailure(req, err) {
    const { level, category } = classifyError(err);
    logDomainEvent(req, {
        domain: "showroom",
        event: "submit",
        resourceType: "showroom",
        resourceId: req.params?.id,
        status: category === "business_blocked" ? "blocked" : "failed",
        meta: {
            code: err?.code || "INTERNAL_ERROR",
        },
    }, level);
}

// CREATE
export async function createShowroomController(req, res, next) {
    try {
        const draftMode =
            req.query?.mode === "draft" || req.body?.draft === true;
        const showroom = await createShowroom(req.body, req.user.uid, {
            draft: draftMode,
            userCountry: req.user?.country ?? null,
        });
        logDomainEvent.info(req, {
            domain: "showroom",
            event: "create",
            resourceType: "showroom",
            resourceId: showroom?.id,
            status: "success",
        });
        return ok(res, { showroom });
    } catch (err) {
        logShowroomCreateFailure(req, err);
        next(err);
    }
}

// CREATE DRAFT
export async function createDraftShowroomController(req, res, next) {
    try {
        const showroom = await createDraftShowroom(req.user.uid);
        logDomainEvent.info(req, {
            domain: "showroom",
            event: "create",
            resourceType: "showroom",
            resourceId: showroom?.id,
            status: "success",
        });
        return ok(res, { showroom });
    } catch (err) {
        logShowroomCreateFailure(req, err);
        next(err);
    }
}

// LIST
export async function listShowrooms(req, res, next) {
    try {
        const { showrooms, meta } = await listShowroomsService(
            req.query,
            req.user ?? null
        );
        return ok(res, { showrooms }, meta);
    } catch (err) {
        next(err);
    }
}

// SUGGESTIONS
export async function listShowroomSuggestions(req, res, next) {
    try {
        const { suggestions, meta } = await suggestShowroomsService(
            req.query,
            req.user ?? null
        );
        return ok(res, { suggestions }, meta);
    } catch (err) {
        next(err);
    }
}

// COUNTERS
export async function getShowroomCounters(req, res, next) {
    try {
        const { total, meta } = await countShowroomsService(
            req.query,
            req.user ?? null
        );
        return ok(res, { total }, meta);
    } catch (err) {
        next(err);
    }
}

// GET BY ID
export async function getShowroomById(req, res, next) {
    try {
        const actor = resolveActorIdentity(req);
        const showroom = await getShowroomByIdService(
            req.params.id,
            req.user ?? null
        );
        if (shouldEmitView(actor.actorId, "showroom", showroom.id)) {
            Promise.resolve().then(() =>
                record(buildAnalyticsEvent({
                    eventName: ANALYTICS_EVENTS.SHOWROOM_VIEW,
                    source: "server",
                    actor,
                    context: {
                        surface: "showroom_detail",
                    },
                    resource: {
                        type: "showroom",
                        id: showroom.id,
                        ownerUserId: showroom.ownerUid ?? null,
                    },
                    meta: {
                        producer: "backend_api",
                    },
                }))
            ).catch(e => {
                log.error(`View analytics emit failed (showroom_view ${showroom.id}): ${e?.message || e}`);
            });
        }
        attachAnonymousIdHeader(res, actor);
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// FAVORITE
export async function favoriteShowroom(req, res, next) {
    try {
        await favoriteShowroomService(req.auth.uid, req.params.id);
        return ok(res, { showroomId: req.params.id, status: "favorited" });
    } catch (err) {
        next(err);
    }
}

export async function unfavoriteShowroom(req, res, next) {
    try {
        await unfavoriteShowroomService(req.auth.uid, req.params.id);
        return ok(res, { showroomId: req.params.id, status: "removed" });
    } catch (err) {
        next(err);
    }
}

// UPDATE
export async function updateShowroom(req, res, next) {
    try {
        const showroom = await updateShowroomService(req.params.id, req.body, req.user);
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// DELETE (soft)
export async function deleteShowroom(req, res, next) {
    try {
        const showroom = await deleteShowroomService(req.params.id, req.user);
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// SUBMIT
export async function submitShowroomForReview(req, res, next) {
    try {
        const showroom = await submitShowroomForReviewService(req.params.id, req.user);
        logDomainEvent.info(req, {
            domain: "showroom",
            event: "submit",
            resourceType: "showroom",
            resourceId: showroom?.id ?? req.params.id,
            status: "success",
        });
        return ok(res, { showroom, message: "Submitted for review" });
    } catch (err) {
        logShowroomSubmitFailure(req, err);
        next(err);
    }
}

// SUBMIT (alias)
export async function submitShowroomForReviewController(req, res, next) {
    try {
        const showroom = await submitShowroomForReviewService(req.params.id, req.user);
        logDomainEvent.info(req, {
            domain: "showroom",
            event: "submit",
            resourceType: "showroom",
            resourceId: showroom?.id ?? req.params.id,
            status: "success",
        });
        return ok(res, { showroom });
    } catch (err) {
        logShowroomSubmitFailure(req, err);
        next(err);
    }
}
