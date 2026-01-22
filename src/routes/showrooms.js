import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { ROLES } from "../constants/roles.js";
import { createShowroom, listShowrooms, favoriteShowroom } from "../controllers/showroomController.js";

const router = Router();

router.post(
    "/create",
    authMiddleware,
    loadUser,
    requireRole([ROLES.OWNER, ROLES.MANAGER]),
    createShowroom
);

router.get("/", listShowrooms); // public

router.post(
    "/:id/favorite",
    authMiddleware,
    loadUser,
    favoriteShowroom
);

export default router;
