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
