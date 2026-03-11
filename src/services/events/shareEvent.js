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
import { buildEventResponse, isEventPublished } from "./eventResponse.js";
import { getEventsCollection } from "./firestoreQuery.js";

async function getShareableEventOrThrow(id) {
    const snap = await getEventsCollection().doc(id).get();
    const event = snap.exists ? { id: snap.id, ...snap.data() } : null;

    if (!event || !isEventPublished(event) || isCountryBlocked(event.country)) {
        throw notFound("EVENT_NOT_FOUND");
    }

    return buildEventResponse(event);
}

function buildRecommendedText(name, shareUrl) {
    const safeName = String(name || "Event").trim() || "Event";
    return `Check out "${safeName}" on JM Showroomer: ${shareUrl}`;
}

export async function getEventSharePayloadService(id, options = {}) {
    const platform = normalizeSharePlatform(options.platform);
    const resolvedPlatform = resolveSharePlatform(platform, options.userAgent);
    const event = await getShareableEventOrThrow(id);

    const shareUrl = buildEntityShareUrl("events", event.id);
    const deepLinkUrl = buildEntityDeepLinkUrl("events", event.id);
    const targets = buildEntityTargets("events", event.id, resolvedPlatform);

    return {
        eventId: event.id,
        eventName: event.name ?? null,
        platform: resolvedPlatform,
        shareUrl,
        deepLinkUrl,
        targets,
        recommendedText: buildRecommendedText(event.name, shareUrl),
    };
}

export async function resolveEventShareRedirectService(id, options = {}) {
    const payload = await getEventSharePayloadService(id, options);

    return {
        httpStatus: 302,
        redirectUrl: resolveEntityRedirectUrl(payload),
        payload,
    };
}
