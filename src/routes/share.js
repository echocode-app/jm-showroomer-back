import { Router } from "express";
import { redirectEventShare } from "../controllers/eventController.js";
import { redirectLookbookShare } from "../controllers/lookbookController.js";
import { redirectShowroomShare } from "../controllers/showroomController.js";

const router = Router();

router.get("/lookbooks/:id", redirectLookbookShare);
router.get("/events/:id", redirectEventShare);
router.get("/showrooms/:id", redirectShowroomShare);

export default router;
