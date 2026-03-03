// Canonical analytics event registry.
// All server emits must reference this map to prevent schema drift and string-literal event names.
export const ANALYTICS_EVENTS = {
    APP_OPENED: "app_opened",
    SESSION_STARTED: "session_started",
    SPLASH_VIEW: "splash_view",
    ONBOARDING_STEP_VIEW: "onboarding_step_view",
    ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
    ONBOARDING_COMPLETED: "onboarding_completed",
    CONTINUE_AS_GUEST: "continue_as_guest",
    AUTH_STARTED: "auth_started",
    SCREEN_VIEW: "screen_view",
    SEARCH_EXECUTED: "search_executed",
    FILTER_APPLIED: "filter_applied",
    OWNER_REGISTRATION_VIEW: "owner_registration_view",
    OWNER_REGISTRATION_SUBMITTED: "owner_registration_submitted",
    OWNER_REGISTRATION_COMPLETED: "owner_registration_completed",

    AUTH_COMPLETED: "auth_completed",
    AUTH_FAILED: "auth_failed",

    SHOWROOM_FAVORITE: "showroom_favorite",
    SHOWROOM_UNFAVORITE: "showroom_unfavorite",

    LOOKBOOK_FAVORITE: "lookbook_favorite",
    LOOKBOOK_UNFAVORITE: "lookbook_unfavorite",
    LOOKBOOK_VIEW: "lookbook_view",

    EVENT_WANT_TO_VISIT: "event_want_to_visit",
    EVENT_REMOVE_WANT_TO_VISIT: "event_remove_want_to_visit",
    EVENT_VIEW: "event_view",

    SHOWROOM_CREATE_STARTED: "showroom_create_started",
    SHOWROOM_CREATE_SUBMITTED: "showroom_create_submitted",
    SHOWROOM_SUBMIT_FOR_REVIEW: "showroom_submit_for_review",
    SHOWROOM_VIEW: "showroom_view",
};
