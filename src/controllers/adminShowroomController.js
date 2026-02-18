import {
    approveShowroomService,
    rejectShowroomService,
    deleteShowroomService,
    listShowroomsService,
    getShowroomByIdService,
} from "../services/showroomService.js";
import { ok } from "../utils/apiResponse.js";

// listShowroomsAdmin
export async function listShowroomsAdmin(req, res, next) {
    try {
        const showrooms = await listShowroomsService(req.query, req.user);
        return ok(res, { showrooms });
    } catch (err) {
        next(err);
    }
}

// getShowroomAdmin
export async function getShowroomAdmin(req, res, next) {
    try {
        const showroom = await getShowroomByIdService(req.params.id, req.user);
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
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// deleteShowroomAdmin
export async function deleteShowroomAdmin(req, res, next) {
    try {
        const showroom = await deleteShowroomService(req.params.id, req.user);
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}
