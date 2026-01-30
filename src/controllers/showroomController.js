import {
    createShowroom,
    submitShowroomForReviewService,
    listShowroomsService,
    getShowroomByIdService,
    updateShowroomService,
} from "../services/showroomService.js";
import { ok } from "../utils/apiResponse.js";

// CREATE
export async function createShowroomController(req, res, next) {
    try {
        const draftMode =
            req.query?.mode === "draft" || req.body?.draft === true;
        const showroom = await createShowroom(req.body, req.user.uid, {
            draft: draftMode,
            userCountry: req.user?.country ?? null,
        });
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// LIST
export async function listShowrooms(req, res, next) {
    try {
        const showrooms = await listShowroomsService(req.query, req.user ?? null);
        return ok(res, { showrooms });
    } catch (err) {
        next(err);
    }
}

// GET BY ID
export async function getShowroomById(req, res, next) {
    try {
        const showroom = await getShowroomByIdService(
            req.params.id,
            req.user ?? null
        );
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// FAVORITE (stub)
export async function favoriteShowroom(req, res, next) {
    try {
        return ok(res, { message: "Added to favorites (stub)" });
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

// SUBMIT
export async function submitShowroomForReview(req, res, next) {
    try {
        const showroom = await submitShowroomForReviewService(req.params.id, req.user);
        return ok(res, { showroom, message: "Submitted for review" });
    } catch (err) {
        next(err);
    }
}
