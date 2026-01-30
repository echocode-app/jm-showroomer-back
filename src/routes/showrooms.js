import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { blockRestrictedCountries } from "../middlewares/countryRestriction.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { loadUserIfExists } from "../middlewares/loadUserIfExists.js";
import { ROLES } from "../constants/roles.js";
import {
    listShowrooms,
    createShowroomController,
    getShowroomById,
    favoriteShowroom,
    updateShowroom,
} from "../controllers/showroomController.js";

const router = Router();

// LIST
router.get("/", listShowrooms);

// GET BY ID
router.get("/:id", optionalAuth, loadUserIfExists, getShowroomById);

// CREATE
router.post(
    "/create",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER, ROLES.MANAGER]),
    blockRestrictedCountries,
    createShowroomController
);

// UPDATE
router.patch(
    "/:id",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER]),
    blockRestrictedCountries,
    updateShowroom
);

// FAVORITE (stub)
router.post(
    "/:id/favorite",
    authMiddleware,
    loadUser,
    favoriteShowroom
);

export default router;
