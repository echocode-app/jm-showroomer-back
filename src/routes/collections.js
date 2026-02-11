import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { loadUserIfExists } from "../middlewares/loadUserIfExists.js";
import {
    listFavoriteLookbooks,
    listFavoriteShowrooms,
    syncGuestEvents,
    listWantToVisitEvents,
} from "../controllers/collectionController.js";

const router = Router();

// ROUTE GET /favorites/showrooms
router.get(
    "/favorites/showrooms",
    optionalAuth,
    loadUserIfExists,
    listFavoriteShowrooms
);

// ROUTE GET /favorites/lookbooks
router.get(
    "/favorites/lookbooks",
    optionalAuth,
    loadUserIfExists,
    listFavoriteLookbooks
);

// ROUTE GET /want-to-visit/events
router.get(
    "/want-to-visit/events",
    authMiddleware,
    loadUser,
    listWantToVisitEvents
);

// ROUTE POST /want-to-visit/events/sync
router.post(
    "/want-to-visit/events/sync",
    authMiddleware,
    loadUser,
    syncGuestEvents
);

export default router;
