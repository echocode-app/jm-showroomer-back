import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { blockRestrictedCountries } from "../middlewares/countryRestriction.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { loadUserIfExists } from "../middlewares/loadUserIfExists.js";
import { ROLES } from "../constants/roles.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { showroomCreateSchema } from "../schemas/showroom.create.schema.js";
import { showroomUpdateSchema } from "../schemas/showroom.update.schema.js";
import {
    listShowrooms,
    createShowroomController,
    createDraftShowroomController,
    getShowroomById,
    favoriteShowroom,
    updateShowroom,
    deleteShowroom,
    submitShowroomForReviewController,
} from "../controllers/showroomController.js";

const router = Router();

// LIST
router.get("/", optionalAuth, loadUserIfExists, listShowrooms);

// GET BY ID
router.get("/:id", optionalAuth, loadUserIfExists, getShowroomById);

// CREATE
router.post(
    "/create",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER, ROLES.MANAGER]),
    blockRestrictedCountries,
    (req, res, next) => {
        if (req.query?.mode === "draft") {
            req.body = req.body || {};
            req.body.draft = true;
        }
        next();
    },
    schemaValidate({ body: showroomCreateSchema }),
    createShowroomController
);

// CREATE DRAFT
router.post(
    "/draft",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER]),
    createDraftShowroomController
);

// UPDATE
router.patch(
    "/:id",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER]),
    blockRestrictedCountries,
    schemaValidate({ body: showroomUpdateSchema }),
    updateShowroom
);

// DELETE (soft)
router.delete(
    "/:id",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER]),
    deleteShowroom
);

// SUBMIT
router.post(
    "/:id/submit",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER]),
    submitShowroomForReviewController
);

// FAVORITE (stub)
router.post(
    "/:id/favorite",
    authMiddleware,
    loadUser,
    favoriteShowroom
);

export default router;
