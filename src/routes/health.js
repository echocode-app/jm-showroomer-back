import { Router } from "express";
import { log } from "../config/logger.js";

const router = Router();

router.get("/", (req, res) => {
  log.success("Health check endpoint called ✅");
  res.json({
    status: "ok ✅",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;

// NODE_ENV=prod node src/core/server.js
// curl https://jm-showroomer-back.onrender.com/api/v1/health
