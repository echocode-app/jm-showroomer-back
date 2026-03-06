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

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseInteger(value, defaultValue, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return defaultValue;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function deriveApiBaseUrl() {
  const explicit = normalizeOrigin(process.env.SHARE_API_BASE_URL);
  if (explicit) return explicit;
  return normalizeOrigin(process.env.BASE_URL);
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

const isProd = env === "prod";
if (isProd && allowedOrigins.length === 0) {
  // Fail closed in production: do not silently allow all origins.
  console.error("ALLOWED_ORIGINS is not configured in production");
  throw new Error("ALLOWED_ORIGINS is not configured in production");
}

const requiredProdEnv = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_STORAGE_BUCKET",
];

if (isProd) {
  const missing = requiredProdEnv.filter(key => !String(process.env[key] || "").trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(", ")}`);
  }
}

export const CONFIG = {
  env,
  port: process.env.PORT || 3000,
  trustProxy: parseInteger(process.env.TRUST_PROXY, 1, { min: 0, max: 10 }),
  httpBodyLimit: normalizeUrl(process.env.HTTP_BODY_LIMIT || "1mb"),
  httpUrlEncodedLimit: normalizeUrl(process.env.HTTP_URLENCODED_LIMIT || "1mb"),
  enableSwagger: parseBoolean(process.env.ENABLE_SWAGGER, true),
  allowGuestLookbookWrites: parseBoolean(process.env.ALLOW_GUEST_LOOKBOOK_WRITES, !isProd),
  serverRequestTimeoutMs: parseInteger(process.env.SERVER_REQUEST_TIMEOUT_MS, 30_000, { min: 5_000 }),
  serverHeadersTimeoutMs: parseInteger(process.env.SERVER_HEADERS_TIMEOUT_MS, 35_000, { min: 5_000 }),
  serverKeepAliveTimeoutMs: parseInteger(process.env.SERVER_KEEPALIVE_TIMEOUT_MS, 5_000, { min: 1_000 }),
  shutdownGraceMs: parseInteger(process.env.SHUTDOWN_GRACE_MS, 15_000, { min: 1_000 }),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  allowedOrigins,
  shareApiBaseUrl: deriveApiBaseUrl(),
  shareIosStoreUrl: normalizeUrl(process.env.IOS_APP_STORE_URL),
  shareAndroidStoreUrl: normalizeUrl(process.env.ANDROID_PLAY_STORE_URL),
  shareDeepLinkScheme: normalizeDeepLinkScheme(process.env.APP_DEEPLINK_SCHEME),
};
