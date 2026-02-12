import { ok } from "../utils/apiResponse.js";
import {
    favoriteLookbookService,
    getLookbookByIdService,
    listLookbooksService,
    unfavoriteLookbookService,
} from "../services/lookbooksService.js";
import { attachCoverUrl, attachSignedImages } from "../services/lookbooks/response.js";

export async function createLookbook(req, res, next) {
    try {
        // TODO (MVP2): replace stub with persisted create flow.
        const { name, description } = req.body;
        return ok(res, { lookbook: { name, description, ownerUid: req.user.uid } });
    } catch (err) {
        next(err);
    }
}

export async function listLookbooks(req, res, next) {
    try {
        const { lookbooks, meta } = await listLookbooksService(req.query ?? {});
        const withCover = await Promise.all(lookbooks.map(attachCoverUrl));
        return ok(res, { lookbooks: withCover }, meta);
    } catch (err) {
        next(err);
    }
}

export async function getLookbookById(req, res, next) {
    try {
        const lookbook = await getLookbookByIdService(req.params.id);
        const signed = await attachSignedImages(lookbook);
        return ok(res, { lookbook: signed });
    } catch (err) {
        next(err);
    }
}

export async function favoriteLookbook(req, res, next) {
    try {
        await favoriteLookbookService(req.params.id, req.auth.uid);
        return ok(res, { lookbookId: req.params.id, status: "favorited" });
    } catch (err) {
        next(err);
    }
}

export async function unfavoriteLookbook(req, res, next) {
    try {
        await unfavoriteLookbookService(req.params.id, req.auth.uid);
        return ok(res, { lookbookId: req.params.id, status: "removed" });
    } catch (err) {
        next(err);
    }
}

export async function rsvpLookbook(req, res, next) {
    try {
        const { id } = req.params;
        return ok(res, { lookbookId: id, user: req.user.uid, status: "RSVPed" });
    } catch (err) {
        next(err);
    }
}
