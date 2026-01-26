import { Router } from "express";
import { oauthLogin } from "../controllers/authController.js";

const router = Router();

// POST /auth/oauth
router.post("/oauth", oauthLogin);

// POST /auth/apple
router.post("/apple", (req, res) => {
    res.status(501).json({ message: "Apple OAuth coming soon" });
});

export default router;

// POST /auth/oauth
// Content-Type: application/json
// {
//   "idToken": "<FIREBASE_ID_TOKEN>"
// }

// Authorization: Bearer <idToken>

