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
    syncGuestLookbooks,
} from "../controllers/collectionController.js";

const router = Router();

router.get(
    "/favorites/showrooms",
    optionalAuth,
    loadUserIfExists,
    listFavoriteShowrooms
);

router.get(
    "/favorites/lookbooks",
    authMiddleware,
    loadUser,
    listFavoriteLookbooks
);

router.post(
    "/favorites/lookbooks/sync",
    authMiddleware,
    loadUser,
    syncGuestLookbooks
);

router.get(
    "/want-to-visit/events",
    authMiddleware,
    loadUser,
    listWantToVisitEvents
);

router.post(
    "/want-to-visit/events/sync",
    authMiddleware,
    loadUser,
    syncGuestEvents
);

export default router;
