import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { badRequest, notFound } from "../../core/error.js";
import {
    buildEntityDeepLinkUrl,
    buildEntityShareUrl,
    buildEntityTargets,
    normalizeSharePlatform,
    resolveEntityRedirectUrl,
    resolveSharePlatform,
} from "../share/shareEntity.js";
import { DEV_STORE, useDevMock } from "./_store.js";

async function getApprovedShowroomOrThrow(showroomId) {
    if (!showroomId || typeof showroomId !== "string") {
        throw badRequest("QUERY_INVALID");
    }

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === showroomId);
        if (!showroom || showroom.status !== "approved" || isCountryBlocked(showroom.country)) {
            throw notFound("SHOWROOM_NOT_FOUND");
        }
        return showroom;
    }

    const db = getFirestoreInstance();
    const snap = await db.collection("showrooms").doc(showroomId).get();
    if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = snap.data();
    if (showroom?.status !== "approved" || isCountryBlocked(showroom?.country)) {
        throw notFound("SHOWROOM_NOT_FOUND");
    }

    return { id: snap.id, ...showroom };
}

function buildRecommendedText(showroomName, shareUrl) {
    const name = String(showroomName || "Showroom").trim() || "Showroom";
    return `Check out "${name}" on JM Showroomer: ${shareUrl}`;
}

export async function getShowroomSharePayloadService(showroomId, options = {}) {
    const platform = normalizeSharePlatform(options.platform);
    const resolvedPlatform = resolveSharePlatform(platform, options.userAgent);
    const showroom = await getApprovedShowroomOrThrow(showroomId);

    const shareUrl = buildEntityShareUrl("showrooms", showroom.id);
    const deepLinkUrl = buildEntityDeepLinkUrl("showrooms", showroom.id);
    const targets = buildEntityTargets("showrooms", showroom.id, resolvedPlatform);

    return {
        showroomId: showroom.id,
        showroomName: showroom.name ?? null,
        platform: resolvedPlatform,
        shareUrl,
        deepLinkUrl,
        targets,
        recommendedText: buildRecommendedText(showroom.name, shareUrl),
    };
}

export async function resolveShowroomShareRedirectService(showroomId, options = {}) {
    const payload = await getShowroomSharePayloadService(showroomId, options);

    return {
        httpStatus: 302,
        redirectUrl: resolveEntityRedirectUrl(payload),
        payload,
    };
}
