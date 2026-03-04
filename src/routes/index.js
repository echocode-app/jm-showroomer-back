import { Router } from "express";

import healthRouter from "./health.js";
import userRouter from "./user.js";
import authRouter from "./auth.js";
import showroomsRouter from "./showrooms.js";
import lookbooksRouter from "./lookbooks.js";
import eventsRouter from "./events.js";
import adminRouter from "./admin.js";
import collectionsRouter from "./collections.js";
import analyticsRouter from "./analytics.js";
import shareRouter from "./share.js";

const router = Router();

// Routes
router.use("/health", healthRouter);
router.use("/users", userRouter);
router.use("/auth", authRouter);
router.use("/showrooms", showroomsRouter);
router.use("/lookbooks", lookbooksRouter);
router.use("/events", eventsRouter);
router.use("/collections", collectionsRouter);
router.use("/analytics", analyticsRouter);
router.use("/admin", adminRouter);
router.use("/share", shareRouter);

export default router;
