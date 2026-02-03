import { Router } from "express";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { loadUserIfExists } from "../middlewares/loadUserIfExists.js";
import { ok } from "../utils/apiResponse.js";

const router = Router();

router.use(optionalAuth, loadUserIfExists);

router.get("/favorites/showrooms", (req, res) =>
    ok(res, { items: [] })
);

router.get("/favorites/lookbooks", (req, res) =>
    ok(res, { items: [] })
);

router.get("/want-to-visit/events", (req, res) =>
    ok(res, { items: [] })
);

export default router;
