import {
    approveShowroomService,
    rejectShowroomService,
    deleteShowroomService,
    listShowroomsService,
    getShowroomByIdService,
} from "../services/showroomService.js";
import {
    listAdminModerationQueueService,
    parseAdminShowroomsStatus,
} from "../services/showrooms/adminModerationQueue.js";
import { ok } from "../utils/apiResponse.js";
import { logDomainEvent } from "../utils/logDomainEvent.js";
import { ROLES } from "../constants/roles.js";

// listShowroomsAdmin
export async function listShowroomsAdmin(req, res, next) {
    try {
        const status = parseAdminShowroomsStatus(req.query);
        const isModerationQueue =
            req.user?.role === ROLES.ADMIN && status === "pending";

        // Admin pending queue is isolated from the public list engine so ordering/cursor
        // semantics stay deterministic for moderation workflows.
        const showrooms = isModerationQueue
            ? await listAdminModerationQueueService(req.query, req.user)
            : await listShowroomsService(req.query, req.user);
        return ok(res, { showrooms });
    } catch (err) {
        next(err);
    }
}

// getShowroomAdmin
export async function getShowroomAdmin(req, res, next) {
    try {
        const showroom = await getShowroomByIdService(req.params.id, req.user);
        if (req.user?.role === ROLES.ADMIN && showroom?.status === "pending") {
            const canonical = { ...showroom };
            const pendingSnapshot = canonical.pendingSnapshot ?? null;
            delete canonical.pendingSnapshot;
            // Pending detail exposes both live canonical doc and frozen moderation snapshot.
            // `diff` is reserved for future server-side diffing without changing response shape.
            return ok(res, {
                showroom: {
                    canonical,
                    pendingSnapshot,
                    diff: null,
                },
            });
        }
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// approveShowroom
export async function approveShowroom(req, res, next) {
    try {
        await approveShowroomService(req.params.id, req.user);
        const showroom = await getShowroomByIdService(req.params.id, req.user);
        logDomainEvent.info(req, {
            domain: "moderation",
            event: "approve",
            resourceType: "showroom",
            resourceId: req.params.id,
            status: "success",
        });
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// rejectShowroom
export async function rejectShowroom(req, res, next) {
    try {
        await rejectShowroomService(
            req.params.id,
            req.body?.reason,
            req.user
        );
        const showroom = await getShowroomByIdService(req.params.id, req.user);
        logDomainEvent.info(req, {
            domain: "moderation",
            event: "reject",
            resourceType: "showroom",
            resourceId: req.params.id,
            status: "success",
        });
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// deleteShowroomAdmin
export async function deleteShowroomAdmin(req, res, next) {
    try {
        const showroom = await deleteShowroomService(req.params.id, req.user);
        logDomainEvent.info(req, {
            domain: "showroom",
            event: "delete",
            resourceType: "showroom",
            resourceId: showroom?.id ?? req.params.id,
            status: "success",
        });
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}
