import { ok } from "../utils/apiResponse.js";

export async function createShowroom(req, res, next) {
    try {
        // TODO
        return ok(res, { message: "Showroom created", user: req.user });
    } catch (err) {
        next(err);
    }
}

export async function listShowrooms(req, res, next) {
    try {
        return ok(res, { showrooms: [] });
    } catch (err) {
        next(err);
    }
}

export async function favoriteShowroom(req, res, next) {
    try {
        // TODO
        return ok(res, { message: "Added to favorites", user: req.user });
    } catch (err) {
        next(err);
    }
}
