import { Router } from "express";
import { redirectShowroomShare } from "../controllers/showroomController.js";

const router = Router();

router.get("/showrooms/:id", redirectShowroomShare);

export default router;
