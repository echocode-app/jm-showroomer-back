import { ok } from "../utils/apiResponse.js";
import {
    listWantToVisitEventsService,
    syncGuestEventsStateService,
} from "../services/eventsService.js";
import {
    listFavoriteLookbooksService,
    syncGuestLookbookFavoritesService,
} from "../services/lookbooksService.js";
import { attachCoverUrl } from "../services/lookbooks/response.js";
import { listFavoriteShowroomsService } from "../services/showroomService.js";

export async function listFavoriteShowrooms(req, res, next) {
    try {
        // Backward-compatible public contract: guest access stays available and returns empty list.
        if (!req.auth?.uid) {
            return ok(
                res,
                { items: [] },
                { hasMore: false, nextCursor: null }
            );
        }

        const { items, meta } = await listFavoriteShowroomsService(
            req.auth.uid,
            req.query ?? {}
        );

        return ok(res, { items }, meta);
    } catch (err) {
        next(err);
    }
}

export async function listFavoriteLookbooks(req, res, next) {
    try {
        const { lookbooks, meta } = await listFavoriteLookbooksService(req.auth.uid, req.query ?? {});
        const withCover = await Promise.all(lookbooks.map(attachCoverUrl));
        return ok(res, { items: withCover }, meta);
    } catch (err) {
        next(err);
    }
}

export async function syncGuestLookbooks(req, res, next) {
    try {
        const result = await syncGuestLookbookFavoritesService(req.auth.uid, req.body ?? {});
        return ok(res, result);
    } catch (err) {
        next(err);
    }
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
        const result = await syncGuestEventsStateService(req.auth.uid, req.body ?? {});
        return ok(res, result);
    } catch (err) {
        next(err);
    }
}
