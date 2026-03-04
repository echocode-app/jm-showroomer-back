// Config: index setup.

import dotenv from "dotenv";

const env = process.env.NODE_ENV || "dev";

dotenv.config({ path: `.env.${env}` });

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

function normalizeUrl(url) {
  return String(url || "").trim();
}

function deriveApiBaseUrl() {
  const explicit = normalizeOrigin(process.env.SHARE_API_BASE_URL);
  if (explicit) return explicit;
  return normalizeOrigin(process.env.BASE_URL);
}

function deriveWebFallbackUrl(apiBaseUrl) {
  const explicit = normalizeOrigin(process.env.SHARE_WEB_FALLBACK_URL);
  if (explicit) return explicit;

  const webBase = normalizeOrigin(process.env.WEB_APP_BASE_URL);
  if (webBase) return webBase;

  return normalizeOrigin(apiBaseUrl.replace(/\/api\/v1$/i, ""));
}

function normalizeDeepLinkScheme(value) {
  const raw = normalizeUrl(value || "jmshowroomer://");
  if (!raw) return "jmshowroomer://";
  return raw.endsWith("://") ? raw : `${raw}://`;
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

if (env === "prod" && allowedOrigins.length === 0) {
  // Fail closed in production: do not silently allow all origins.
  console.error("ALLOWED_ORIGINS is not configured in production");
  throw new Error("ALLOWED_ORIGINS is not configured in production");
}

export const CONFIG = {
  env,
  port: process.env.PORT || 3000,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  allowedOrigins,
  shareApiBaseUrl: deriveApiBaseUrl(),
  shareWebFallbackUrl: deriveWebFallbackUrl(deriveApiBaseUrl()),
  shareIosStoreUrl: normalizeUrl(process.env.IOS_APP_STORE_URL),
  shareAndroidStoreUrl: normalizeUrl(process.env.ANDROID_PLAY_STORE_URL),
  shareDeepLinkScheme: normalizeDeepLinkScheme(process.env.APP_DEEPLINK_SCHEME),
};
