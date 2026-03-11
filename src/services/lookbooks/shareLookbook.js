import { isCountryBlocked } from "../../constants/countries.js";
import { notFound } from "../../core/error.js";
import {
    buildEntityDeepLinkUrl,
    buildEntityShareUrl,
    buildEntityTargets,
    normalizeSharePlatform,
    resolveEntityRedirectUrl,
    resolveSharePlatform,
} from "../share/shareEntity.js";
import { getLookbooksCollection } from "./firestoreQuery.js";
import { normalizeLookbook } from "./response.js";

async function getShareableLookbookOrThrow(id) {
    const snap = await getLookbooksCollection().doc(id).get();
    const lookbook = snap.exists ? normalizeLookbook({ id: snap.id, ...snap.data() }) : null;

    if (!lookbook || lookbook.published !== true || isCountryBlocked(lookbook.country)) {
        throw notFound("LOOKBOOK_NOT_FOUND");
    }

    return lookbook;
}

function buildRecommendedText(title, shareUrl) {
    const safeTitle = String(title || "Lookbook").trim() || "Lookbook";
    return `Check out "${safeTitle}" on JM Showroomer: ${shareUrl}`;
}

export async function getLookbookSharePayloadService(id, options = {}) {
    const platform = normalizeSharePlatform(options.platform);
    const resolvedPlatform = resolveSharePlatform(platform, options.userAgent);
    const lookbook = await getShareableLookbookOrThrow(id);

    const shareUrl = buildEntityShareUrl("lookbooks", lookbook.id);
    const deepLinkUrl = buildEntityDeepLinkUrl("lookbooks", lookbook.id);
    const targets = buildEntityTargets("lookbooks", lookbook.id, resolvedPlatform);

    return {
        lookbookId: lookbook.id,
        lookbookTitle: lookbook.title ?? lookbook.name ?? null,
        platform: resolvedPlatform,
        shareUrl,
        deepLinkUrl,
        targets,
        recommendedText: buildRecommendedText(lookbook.title ?? lookbook.name, shareUrl),
    };
}

export async function resolveLookbookShareRedirectService(id, options = {}) {
    const payload = await getLookbookSharePayloadService(id, options);

    return {
        httpStatus: 302,
        redirectUrl: resolveEntityRedirectUrl(payload),
        payload,
    };
}
