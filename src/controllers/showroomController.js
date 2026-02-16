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

// CREATE DRAFT
export async function createDraftShowroomController(req, res, next) {
    try {
        const showroom = await createDraftShowroom(req.user.uid);
        return ok(res, { showroom });
    } catch (err) {
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
        const showroom = await getShowroomByIdService(
            req.params.id,
            req.user ?? null
        );
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

// FAVORITE
export async function favoriteShowroom(req, res, next) {
    try {
        const result = await favoriteShowroomService(req.auth.uid, req.params.id);
        return ok(res, { showroomId: req.params.id, ...result });
    } catch (err) {
        next(err);
    }
}

export async function unfavoriteShowroom(req, res, next) {
    try {
        const result = await unfavoriteShowroomService(req.auth.uid, req.params.id);
        return ok(res, { showroomId: req.params.id, ...result });
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
        return ok(res, { showroom, message: "Submitted for review" });
    } catch (err) {
        next(err);
    }
}

// SUBMIT (alias)
export async function submitShowroomForReviewController(req, res, next) {
    try {
        const showroom = await submitShowroomForReviewService(req.params.id, req.user);
        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}
