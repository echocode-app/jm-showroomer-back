import { Router } from "express";
import { oauthLogin } from "../controllers/authController.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { authOauthSchema } from "../schemas/auth.oauth.schema.js";

const router = Router();

// POST /auth/oauth
router.post("/oauth", schemaValidate({ body: authOauthSchema }), oauthLogin);

export default router;
