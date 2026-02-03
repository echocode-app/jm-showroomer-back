import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { ROLES } from "../constants/roles.js";
import { completeOwnerProfileSchema } from "../schemas/user.complete-owner-profile.schema.js";
import { userProfileUpdateSchema } from "../schemas/user.profile.schema.js";

import {
  getMyProfile,
  completeOnboarding,
  completeOwnerProfile,
  updateUserProfile,
  makeOwnerDev,
} from "../controllers/userController.js";

import { registerTestUser } from "../controllers/testUserController.js";

const router = Router();

/**
 * GET /users/me
 */
router.get(
  "/me",
  authMiddleware,
  loadUser,
  getMyProfile
);

/**
 * POST /users/complete-onboarding
 */
router.post(
  "/complete-onboarding",
  authMiddleware,
  loadUser,
  completeOnboarding
);

/**
 * POST /users/complete-owner-profile
 */
router.post(
  "/complete-owner-profile",
  authMiddleware,
  loadUser,
  requireRole([ROLES.USER, ROLES.OWNER]),
  schemaValidate({ body: completeOwnerProfileSchema }),
  completeOwnerProfile
);

/**
 * PATCH /users/profile
 */
router.patch(
  "/profile",
  authMiddleware,
  loadUser,
  schemaValidate({ body: userProfileUpdateSchema }),
  updateUserProfile
);

/**
 * DEV: create test user
 */
router.post(
  "/dev/register-test",
  registerTestUser
);

/**
 * DEV: upgrade current user to owner
 */
router.post(
  "/dev/make-owner",
  authMiddleware,
  loadUser,
  makeOwnerDev
);

export default router;
