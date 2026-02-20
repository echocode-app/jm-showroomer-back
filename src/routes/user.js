import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { requireRole } from "../middlewares/role.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { ROLES } from "../constants/roles.js";
import { completeOwnerProfileSchema } from "../schemas/user.complete-owner-profile.schema.js";
import { userProfileUpdateSchema } from "../schemas/user.profile.schema.js";
import {
  userDeviceParamsSchema,
  userDeviceRegisterSchema,
} from "../schemas/user.device.schema.js";

import {
  getMyProfile,
  completeOnboarding,
  completeOwnerProfile,
  updateUserProfile,
  makeOwnerDev,
  deleteMyProfile,
  listMyNotifications,
  markMyNotificationRead,
  getMyUnreadNotificationsCount,
  registerMyDevice,
  deleteMyDevice,
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
 * DELETE /users/me
 */
router.delete(
  "/me",
  authMiddleware,
  deleteMyProfile
);

/**
 * GET /users/me/notifications
 */
router.get(
  "/me/notifications",
  authMiddleware,
  loadUser,
  listMyNotifications
);

/**
 * GET /users/me/notifications/unread-count
 */
router.get(
  "/me/notifications/unread-count",
  authMiddleware,
  loadUser,
  getMyUnreadNotificationsCount
);

/**
 * PATCH /users/me/notifications/:notificationId/read
 */
router.patch(
  "/me/notifications/:notificationId/read",
  authMiddleware,
  loadUser,
  markMyNotificationRead
);

/**
 * POST /users/me/devices
 */
router.post(
  "/me/devices",
  authMiddleware,
  loadUser,
  schemaValidate({ body: userDeviceRegisterSchema }),
  registerMyDevice
);

/**
 * DELETE /users/me/devices/:deviceId
 */
router.delete(
  "/me/devices/:deviceId",
  authMiddleware,
  loadUser,
  schemaValidate({ params: userDeviceParamsSchema }),
  deleteMyDevice
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
