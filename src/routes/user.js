import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { ROLES } from "../constants/roles.js";

import {
  getMyProfile,
  requestOwnerRole,
  completeOnboarding,
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
 * POST /users/request-owner
 */
router.post(
  "/request-owner",
  authMiddleware,
  loadUser,
  requireRole([ROLES.USER]),
  requestOwnerRole
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
 * DEV: create test user
 */
router.post(
  "/dev/register-test",
  registerTestUser
);

export default router;
