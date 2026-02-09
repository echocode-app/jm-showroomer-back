import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { ROLES } from "../constants/roles.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { lookbookCreateSchema } from "../schemas/lookbook.create.schema.js";
import { eventRsvpSchema } from "../schemas/event.rsvp.schema.js";
import { createLookbook, listLookbooks, rsvpLookbook } from "../controllers/lookbookController.js";

const router = Router();

router.post(
    "/create",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER, ROLES.MANAGER]),
    schemaValidate({ body: lookbookCreateSchema }),
    createLookbook
);

// ROUTE GET /
router.get("/", listLookbooks);

router.post(
    "/:id/rsvp",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    rsvpLookbook
);

export default router;
