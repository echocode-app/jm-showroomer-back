import { CONFIG } from "../../config/index.js";
import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, notFound } from "../../core/error.js";
import { DEV_STORE, useDevMock } from "./_store.js";

const PLATFORM_SET = new Set(["auto", "ios", "android", "web"]);

function normalizePlatform(value) {
    const normalized = String(value || "auto").trim().toLowerCase();
    if (!PLATFORM_SET.has(normalized)) {
        throw badRequest("QUERY_INVALID");
    }
    return normalized;
}

function detectPlatformFromUserAgent(userAgent) {
    const ua = String(userAgent || "").toLowerCase();
    if (!ua) return "web";
    if (ua.includes("android")) return "android";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
    return "web";
}

function resolvePlatform(platform, userAgent) {
    if (platform !== "auto") return platform;
    return detectPlatformFromUserAgent(userAgent);
}

function appendShareParams(rawUrl, showroomId, platform) {
    const url = String(rawUrl || "").trim();
    if (!url) return null;

    const hasQuery = url.includes("?");
    const separator = hasQuery ? "&" : "?";
    return `${url}${separator}ref=showroom_share&showroomId=${encodeURIComponent(showroomId)}&platform=${encodeURIComponent(platform)}`;
}

function buildDeepLinkUrl(showroomId) {
    const scheme = CONFIG.shareDeepLinkScheme;
    return `${scheme}showrooms/${encodeURIComponent(showroomId)}`;
}

function buildShareUrl(showroomId) {
    const base = String(CONFIG.shareApiBaseUrl || "").replace(/\/+$/, "");
    return `${base}/share/showrooms/${encodeURIComponent(showroomId)}`;
}

async function getApprovedShowroomOrThrow(showroomId) {
    if (!showroomId || typeof showroomId !== "string") {
        throw badRequest("QUERY_INVALID");
    }

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === showroomId);
        if (!showroom || showroom.status !== "approved") {
            throw notFound("SHOWROOM_NOT_FOUND");
        }
        return showroom;
    }

    const db = getFirestoreInstance();
    const snap = await db.collection("showrooms").doc(showroomId).get();
    if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = snap.data();
    if (showroom?.status !== "approved") {
        throw notFound("SHOWROOM_NOT_FOUND");
    }

    return { id: snap.id, ...showroom };
}

function buildTargets(showroomId, platform) {
    return {
        ios: appendShareParams(CONFIG.shareIosStoreUrl, showroomId, platform),
        android: appendShareParams(CONFIG.shareAndroidStoreUrl, showroomId, platform),
        web: appendShareParams(CONFIG.shareWebFallbackUrl, showroomId, platform),
    };
}

function buildRecommendedText(showroomName, shareUrl) {
    const name = String(showroomName || "Showroom").trim() || "Showroom";
    return `Check out "${name}" on JM Showroomer: ${shareUrl}`;
}

export async function getShowroomSharePayloadService(showroomId, options = {}) {
    const platform = normalizePlatform(options.platform);
    const resolvedPlatform = resolvePlatform(platform, options.userAgent);
    const showroom = await getApprovedShowroomOrThrow(showroomId);

    const shareUrl = buildShareUrl(showroom.id);
    const deepLinkUrl = buildDeepLinkUrl(showroom.id);
    const targets = buildTargets(showroom.id, resolvedPlatform);

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

    let redirectUrl = payload.targets.web || payload.shareUrl;
    if (payload.platform === "ios") {
        redirectUrl = payload.targets.ios || payload.targets.web || payload.shareUrl;
    } else if (payload.platform === "android") {
        redirectUrl = payload.targets.android || payload.targets.web || payload.shareUrl;
    }

    return {
        httpStatus: 302,
        redirectUrl,
        payload,
    };
}
