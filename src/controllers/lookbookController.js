import { ok, fail } from "../utils/apiResponse.js";
import { listLookbooksService } from "../services/lookbooks/listLookbooks.js";
import { getSignedReadUrl } from "../services/mediaService.js";

// createLookbook
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

// listLookbooks
export async function listLookbooks(req, res, next) {
    try {
        const limit = req.query?.limit;
        const lookbooks = await listLookbooksService({ limit });

        const withUrls = await Promise.all(
            lookbooks.map(async item => ({
                ...item,
                coverUrl: await getSignedReadUrl(item.coverPath),
            }))
        );

        return ok(res, { lookbooks: withUrls });
    } catch (err) {
        next(err);
    }
}

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
