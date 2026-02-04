import { Router } from "express";
import { oauthLogin } from "../controllers/authController.js";

const router = Router();

// POST /auth/oauth
router.post("/oauth", oauthLogin);

export default router;
