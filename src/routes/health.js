import { Router } from "express";
import { log } from "../config/logger.js";

const router = Router();

router.get("/", (req, res) => {
    log.success("Health check ✅");
    res.json({ status: "ok", message: "Server running" });
});

export default router;
