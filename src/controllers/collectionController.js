import { ok } from "../utils/apiResponse.js";
import {
    listWantToVisitEventsService,
    syncGuestEventsStateService,
} from "../services/eventsService.js";

export async function listFavoriteShowrooms(req, res) {
    return ok(res, { items: [] });
}

export async function listFavoriteLookbooks(req, res) {
    return ok(res, { items: [] });
}

export async function listWantToVisitEvents(req, res, next) {
    try {
        const { events, meta } = await listWantToVisitEventsService(
            req.auth.uid,
            req.query ?? {}
        );
        return ok(res, { items: events }, meta);
    } catch (err) {
        next(err);
    }
}

export async function syncGuestEvents(req, res, next) {
    try {
        // Auth-only sync from guest-local state to persistent user collections.
        const result = await syncGuestEventsStateService(req.auth.uid, req.body ?? {});
        return ok(res, result);
    } catch (err) {
        next(err);
    }
}
