import { Router } from "express";
import { ingestAnalyticsEvents } from "../controllers/analyticsController.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { loadUserIfExists } from "../middlewares/loadUserIfExists.js";

const router = Router();

router.post("/ingest", optionalAuth, loadUserIfExists, ingestAnalyticsEvents);

export default router;
