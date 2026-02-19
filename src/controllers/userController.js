// Keep legacy import surface stable while user controller logic
// remains split by responsibility in dedicated modules.
export {
    getMyProfile,
    completeOnboarding,
    completeOwnerProfile,
    updateUserProfile,
} from "./users/profileController.js";

export {
    makeOwnerDev,
    deleteMyProfile,
} from "./users/accountController.js";

export {
    listMyNotifications,
    markMyNotificationRead,
    getMyUnreadNotificationsCount,
} from "./users/notificationsController.js";
