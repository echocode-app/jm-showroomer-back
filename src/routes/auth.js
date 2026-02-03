import { Router } from "express";
import { oauthLogin } from "../controllers/authController.js";
import { fail } from "../utils/apiResponse.js";

const router = Router();

// POST /auth/oauth
router.post("/oauth", oauthLogin);

// POST /auth/apple
router.post("/apple", (req, res) => {
    return fail(res, "NOT_IMPLEMENTED", "Apple OAuth coming soon", 501);
});

export default router;
