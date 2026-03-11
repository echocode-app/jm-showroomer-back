import { CONFIG } from "../../config/index.js";
import { badRequest } from "../../core/error.js";

const PLATFORM_SET = new Set(["auto", "ios", "android"]);

export function normalizeSharePlatform(value) {
    const normalized = String(value || "auto").trim().toLowerCase();
    if (!PLATFORM_SET.has(normalized)) {
        throw badRequest("QUERY_INVALID");
    }
    return normalized;
}

function detectPlatformFromUserAgent(userAgent) {
    const ua = String(userAgent || "").toLowerCase();
    if (!ua) return "ios";
    if (ua.includes("android")) return "android";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
    return "ios";
}

export function resolveSharePlatform(platform, userAgent) {
    if (platform !== "auto") return platform;
    return detectPlatformFromUserAgent(userAgent);
}

function appendShareParams(rawUrl, entityType, entityId, platform) {
    const url = String(rawUrl || "").trim();
    if (!url) return null;

    const hasQuery = url.includes("?");
    const separator = hasQuery ? "&" : "?";
    return `${url}${separator}ref=${encodeURIComponent(`${entityType}_share`)}&${encodeURIComponent(entityType)}Id=${encodeURIComponent(entityId)}&platform=${encodeURIComponent(platform)}`;
}

export function buildEntityDeepLinkUrl(entityType, entityId) {
    const scheme = CONFIG.shareDeepLinkScheme;
    return `${scheme}${entityType}/${encodeURIComponent(entityId)}`;
}

export function buildEntityShareUrl(entityType, entityId) {
    const base = String(CONFIG.shareApiBaseUrl || "").replace(/\/+$/, "");
    return `${base}/share/${entityType}/${encodeURIComponent(entityId)}`;
}

export function buildEntityTargets(entityType, entityId, platform) {
    return {
        ios: appendShareParams(CONFIG.shareIosStoreUrl, entityType, entityId, platform),
        android: appendShareParams(CONFIG.shareAndroidStoreUrl, entityType, entityId, platform),
    };
}

export function resolveEntityRedirectUrl(payload) {
    let redirectUrl = payload.targets.ios || payload.targets.android;
    if (payload.platform === "android") {
        redirectUrl = payload.targets.android || payload.targets.ios;
    }
    return redirectUrl;
}
