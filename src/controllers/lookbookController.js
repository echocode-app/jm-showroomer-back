import { ok, fail } from "../utils/apiResponse.js";
import { listLookbooksService } from "../services/lookbooks/listLookbooks.js";
import { getSignedReadUrl } from "../services/mediaService.js";
import { filterValidAssets, normalizeLookbookAssets } from "../utils/mediaValidation.js";

// createLookbook
export async function createLookbook(req, res, next) {
    try {
        // TODO
        const { name, description } = req.body;
        // TODO
        return ok(res, { lookbook: { name, description, ownerUid: req.user.uid } });
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
            lookbooks.map(async item => {
                const resourceId = item.id;
                const normalizedAssets = normalizeLookbookAssets(item);
                const validAssets = filterValidAssets("lookbooks", resourceId, normalizedAssets);

                const coverAsset = validAssets.find(a => a.kind === "cover");
                const coverUrl = coverAsset ? await getSignedReadUrl(coverAsset.path) : null;

                return {
                    ...item,
                    coverUrl,
                    assets: item.assets && item.assets.length ? item.assets : normalizedAssets,
                };
            })
        );

        return ok(res, { lookbooks: withUrls });
    } catch (err) {
        next(err);
    }
}

// rsvpLookbook
export async function rsvpLookbook(req, res, next) {
    try {
        const { id } = req.params;
        return ok(res, { lookbookId: id, user: req.user.uid, status: "RSVPed" });
    } catch (err) {
        next(err);
    }
}
