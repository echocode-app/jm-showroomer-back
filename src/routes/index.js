import { Router } from "express";
import healthRouter from "./health.js";
import userRouter from "./user.js";

const router = Router();

router.use("/health", healthRouter);
router.use("/users", userRouter);

export default router;
