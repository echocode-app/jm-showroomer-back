import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { ROLES } from "../constants/roles.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { showroomReviewSchema } from "../schemas/showroom.review.schema.js";
import {
    approveShowroom,
    rejectShowroom,
    deleteShowroomAdmin,
    listShowroomsAdmin,
    getShowroomAdmin,
    getShowroomHistoryAdmin,
    getShowroomStatsAdmin,
} from "../controllers/adminShowroomController.js";

const router = Router();

router.use(authMiddleware, loadUser, requireRole([ROLES.ADMIN]));

// LIST ALL (incl pending/deleted)
router.get("/showrooms", listShowroomsAdmin);

// GET BY ID
router.get("/showrooms/:id", getShowroomAdmin);

// HISTORY / STATS
router.get("/showrooms/:id/history", getShowroomHistoryAdmin);
router.get("/showrooms/:id/stats", getShowroomStatsAdmin);

// APPROVE
router.post("/showrooms/:id/approve", approveShowroom);

// REJECT
router.post(
    "/showrooms/:id/reject",
    schemaValidate({ body: showroomReviewSchema }),
    rejectShowroom
);

// DELETE (soft)
router.delete("/showrooms/:id", deleteShowroomAdmin);

export default router;
