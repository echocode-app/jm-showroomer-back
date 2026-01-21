// src/controllers/lookbookController.js
import { ok, fail } from "../utils/apiResponse.js";

export async function createLookbook(req, res, next) {
    try {
        // TODO
        const { name, description } = req.body;
        // TODO
        return ok(res, { lookbook: { name, description, owner: req.user.uid } });
    } catch (err) {
        next(err);
    }
}

export async function listLookbooks(req, res, next) {
    try {
        // TODO
        return ok(res, { lookbooks: [] }); // TODO
    } catch (err) {
        next(err);
    }
}

export async function rsvpEvent(req, res, next) {
    try {
        const { id } = req.params;
        // TODO RSVP
        return ok(res, { eventId: id, user: req.user.uid, status: "RSVPed" });
    } catch (err) {
        next(err);
    }
}
