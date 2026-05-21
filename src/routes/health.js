import { Router } from "express";
import { CONFIG } from "../config/index.js";
import { getFirestoreInstance } from "../config/firebase.js";

const router = Router();
const READY_TIMEOUT_MS = 1500;

// Backward-compatible health endpoint.
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "jm-showroomer-api",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get("/live", (req, res) => {
  res.json({
    status: "live",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get("/ping", (req, res) => {
  if (!CONFIG.uptimePingEnabled) {
    return res.status(404).json({
      status: "disabled",
      code: "UPTIME_PING_DISABLED",
      message: "External uptime ping endpoint is disabled",
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    status: "pong",
    service: "jm-showroomer-api",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get("/ready", async (req, res) => {
  const checks = {
    firebase: false,
    firestore: false,
  };

  try {
    checks.firebase = true;
    const db = getFirestoreInstance();
    await Promise.race([
      db.collection("showrooms").limit(1).get(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("firestore_check_timeout")), READY_TIMEOUT_MS)
      ),
    ]);
    checks.firestore = true;

    return res.json({
      status: "ready",
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      status: "not_ready",
      checks,
      code: "SERVICE_UNAVAILABLE",
      message: "Service dependencies are not ready",
      timestamp: new Date().toISOString(),
    });
  }
});

router.get("/startup", (req, res) => {
  res.json({
    status: "started",
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
});

export default router;
