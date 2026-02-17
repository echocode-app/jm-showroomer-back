import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { loadUserIfExists } from "../middlewares/loadUserIfExists.js";
import {
    listFavoriteLookbooks,
    listFavoriteShowrooms,
    syncGuestShowrooms,
    syncGuestEvents,
    listWantToVisitEvents,
    syncGuestLookbooks,
} from "../controllers/collectionController.js";

const router = Router();

// Public-compatible endpoint: guest receives an empty list,
// authenticated user receives actual persisted favorites.
router.get(
    "/favorites/showrooms",
    optionalAuth,
    loadUserIfExists,
    listFavoriteShowrooms
);

// Sync promotes guest-local showroom favorites into user profile after login.
router.post(
    "/favorites/showrooms/sync",
    authMiddleware,
    loadUser,
    syncGuestShowrooms
);

// Public-compatible endpoint for lookbook favorites collection.
router.get(
    "/favorites/lookbooks",
    optionalAuth,
    loadUserIfExists,
    listFavoriteLookbooks
);

// Sync promotes guest-local lookbook favorites after authentication.
router.post(
    "/favorites/lookbooks/sync",
    authMiddleware,
    loadUser,
    syncGuestLookbooks
);

// Public-compatible endpoint for "want to visit" events collection.
router.get(
    "/want-to-visit/events",
    optionalAuth,
    loadUserIfExists,
    listWantToVisitEvents
);

// Sync merges guest-local event state with persisted user state.
router.post(
    "/want-to-visit/events/sync",
    authMiddleware,
    loadUser,
    syncGuestEvents
);

export default router;
