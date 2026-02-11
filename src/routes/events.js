import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { loadUserIfExists } from "../middlewares/loadUserIfExists.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { eventRsvpSchema } from "../schemas/event.rsvp.schema.js";
import {
    dismissEvent,
    getEventById,
    listEvents,
    markWantToVisit,
    removeWantToVisit,
    rsvpEvent,
    undismissEvent,
} from "../controllers/eventController.js";

const router = Router();

// Public events endpoints with optional auth context for user-state enrichment.
router.get("/", optionalAuth, loadUserIfExists, listEvents);
router.get("/:id", optionalAuth, loadUserIfExists, schemaValidate({ params: eventRsvpSchema }), getEventById);

// Mutating endpoints are auth-only and operate on per-user event state.
router.post(
    "/:id/want-to-visit",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    markWantToVisit
);

router.delete(
    "/:id/want-to-visit",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    removeWantToVisit
);

router.post(
    "/:id/dismiss",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    dismissEvent
);

router.delete(
    "/:id/dismiss",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    undismissEvent
);

router.post(
    "/:id/rsvp",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    rsvpEvent
);

export default router;
