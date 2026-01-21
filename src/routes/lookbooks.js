import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { createLookbook, listLookbooks, rsvpEvent } from "../controllers/lookbookController.js";

const router = Router();

router.post("/create", authMiddleware, requireRole("owner"), createLookbook);

router.get("/", listLookbooks);

router.post("/:id/rsvp", authMiddleware, rsvpEvent);

export default router;
