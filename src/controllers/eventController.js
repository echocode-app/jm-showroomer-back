import { ok } from "../utils/apiResponse.js";

// rsvpEvent
export async function rsvpEvent(req, res, next) {
    try {
        const { id } = req.params;
        // TODO RSVP
        return ok(res, { eventId: id, user: req.user.uid, status: "RSVPed" });
    } catch (err) {
        next(err);
    }
}
