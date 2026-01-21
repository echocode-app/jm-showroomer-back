import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { createShowroom, listShowrooms, favoriteShowroom } from "../controllers/showroomController.js";

const router = Router();

router.post("/create", authMiddleware, requireRole("owner"), createShowroom);

router.get("/", listShowrooms);

router.post("/:id/favorite", authMiddleware, favoriteShowroom);

export default router;
