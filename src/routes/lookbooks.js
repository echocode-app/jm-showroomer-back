import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { ROLES } from "../constants/roles.js";
import { createLookbook, listLookbooks, rsvpEvent } from "../controllers/lookbookController.js";

const router = Router();

router.post(
    "/create",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER, ROLES.MANAGER]),
    createLookbook
);

router.get("/", listLookbooks); // public

router.post(
    "/:id/rsvp",
    authMiddleware,
    loadUser,
    rsvpEvent
);

export default router;
