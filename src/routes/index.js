import { Router } from "express";

import healthRouter from "./health.js";
import userRouter from "./user.js";
import authRouter from "./auth.js";
import showroomsRouter from "./showrooms.js";
import lookbooksRouter from "./lookbooks.js";
import adminRouter from "./admin.js";

const router = Router();

// Routes
router.use("/health", healthRouter);
router.use("/users", userRouter);
router.use("/auth", authRouter);
router.use("/showrooms", showroomsRouter);
router.use("/lookbooks", lookbooksRouter);
router.use("/admin", adminRouter);

export default router;
