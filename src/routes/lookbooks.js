import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { lookbookCreateSchema } from "../schemas/lookbook.create.schema.js";
import { lookbookUpdateSchema } from "../schemas/lookbook.update.schema.js";
import { eventRsvpSchema } from "../schemas/event.rsvp.schema.js";
import {
    createLookbook,
    deleteLookbook,
    favoriteLookbook,
    getLookbookById,
    listLookbooks,
    rsvpLookbook,
    unfavoriteLookbook,
    updateLookbook,
} from "../controllers/lookbookController.js";

const router = Router();

router.post(
    "/",
    optionalAuth,
    schemaValidate({ body: lookbookCreateSchema }),
    createLookbook
);

// Backward-compatible alias for legacy clients/tests.
router.post(
    "/create",
    optionalAuth,
    schemaValidate({ body: lookbookCreateSchema }),
    createLookbook
);

router.get("/", optionalAuth, listLookbooks);

router.get(
    "/:id",
    optionalAuth,
    schemaValidate({ params: eventRsvpSchema }),
    getLookbookById
);

router.patch(
    "/:id",
    optionalAuth,
    schemaValidate({ params: eventRsvpSchema, body: lookbookUpdateSchema }),
    updateLookbook
);

router.delete(
    "/:id",
    optionalAuth,
    schemaValidate({ params: eventRsvpSchema }),
    deleteLookbook
);

router.post(
    "/:id/favorite",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    favoriteLookbook
);

router.delete(
    "/:id/favorite",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    unfavoriteLookbook
);

router.post(
    "/:id/rsvp",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    rsvpLookbook
);

export default router;
