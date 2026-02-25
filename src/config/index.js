// Config: index setup.

import dotenv from "dotenv";

const env = process.env.NODE_ENV || "dev";

dotenv.config({ path: `.env.${env}` });

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
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
};
