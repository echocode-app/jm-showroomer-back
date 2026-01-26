import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { ROLES } from "../constants/roles.js";

import {
  getMyProfile,
  requestOwnerRole,
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
 * DEV: create test user
 */
router.post(
  "/dev/register-test",
  registerTestUser
);

export default router;


// {
//   "success": true,
//   "data": {
//     "user": {
//       "uid": "...",
//       "email": "...",
//       "name": "...",
//       "avatar": "...",
//       "role": "user",
//       "roles": ["user"],
//       "status": "active",
//       "onboardingState": "new",
//       "createdAt": "...",
//       "updatedAt": "..."
//     }
//   }
// }