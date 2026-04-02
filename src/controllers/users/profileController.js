import { isCountryBlocked, normalizeCountry } from "../../constants/countries.js";
import { ok, fail } from "../../utils/apiResponse.js";
import {
    normalizeInstagramUrl,
    validatePhone,
    validateInstagramUrl,
} from "../../utils/showroomValidation.js";
import {
    updateUserOnboarding,
    updateOwnerProfile,
    updateUserProfileDoc,
    ownerHasActiveShowrooms,
} from "../../services/users/profileService.js";
import { ANALYTICS_EVENTS } from "../../services/analytics/eventNames.js";
import { buildAnalyticsEvent } from "../../services/analytics/analyticsEventBuilder.js";
import { record } from "../../services/analytics/analyticsEventService.js";
import { log } from "../../config/logger.js";
import { normalizeAppLanguage } from "../../constants/appLanguage.js";

/**
 * Returns authenticated user profile from middleware context.
 */
export async function getMyProfile(req, res) {
    return ok(res, req.user);
}

/**
 * Completes onboarding by persisting allowed country.
 */
export async function completeOnboarding(req, res) {
    try {
        const trimmedCountry = String(req.body?.country ?? "").trim();

        if (!trimmedCountry) {
            return fail(res, "COUNTRY_REQUIRED", "Country is required", 400);
        }

        if (isCountryBlocked(trimmedCountry)) {
            return fail(res, "COUNTRY_BLOCKED", "Country is not supported", 403);
        }

        if (req.user.onboardingState === "completed") {
            return ok(res, { message: "Onboarding already completed" });
        }

        await updateUserOnboarding(req.user.uid, trimmedCountry);
        try {
            await record(buildAnalyticsEvent({
                eventName: ANALYTICS_EVENTS.ONBOARDING_COMPLETED,
                source: "server",
                actor: {
                    userId: req.user?.uid ?? null,
                    isAnonymous: false,
                },
                context: {
                    surface: "onboarding",
                    route: "/api/v1/users/complete-onboarding",
                    method: "POST",
                },
                resource: {
                    type: "onboarding",
                    id: "completed",
                },
                meta: {
                    producer: "backend_api",
                },
            }));
        } catch (err) {
            log.error(`Analytics emit failed (onboarding_completed): ${err?.message || err}`);
        }

        return ok(res, { message: "Onboarding completed" });
    } catch (err) {
        log.error(`completeOnboarding failed uid=${req.user?.uid ?? "unknown"}: ${err?.stack || err?.message || err}`);
        return fail(res, err.code || "INTERNAL_ERROR", err.message || "Internal server error", err.status || 500);
    }
}

/**
 * Validates owner profile fields and upgrades user role to owner.
 */
export async function completeOwnerProfile(req, res) {
    const { name, position = null, country, phone, instagram } = req.body || {};

    const trimmedName = String(name ?? "").trim();
    const trimmedCountry = String(country ?? "").trim();
    const trimmedPhone = String(phone ?? "").trim();
    const trimmedInstagram = String(instagram ?? "").trim();

    if (!trimmedName || !trimmedCountry || !trimmedPhone || !trimmedInstagram) {
        return fail(res, "VALIDATION_ERROR", "Missing required fields", 400);
    }

    if (isCountryBlocked(trimmedCountry)) {
        return fail(res, "COUNTRY_BLOCKED", "Country is not supported", 403);
    }

    try {
        const wasOwner = req.user?.role === "owner";
        const { e164 } = validatePhone(trimmedPhone, trimmedCountry);
        const normalizedInstagram = normalizeInstagramUrl(trimmedInstagram);
        validateInstagramUrl(normalizedInstagram);

        const now = new Date().toISOString();
        const ownerProfile = {
            name: trimmedName,
            position: position ? String(position).trim() : null,
            phone: e164,
            instagram: normalizedInstagram,
        };

        await updateOwnerProfile(req.user.uid, {
            name: trimmedName,
            country: trimmedCountry,
            ownerProfile,
            updatedAt: now,
        });

        if (!wasOwner) {
            try {
                await record(buildAnalyticsEvent({
                    eventName: ANALYTICS_EVENTS.OWNER_REGISTRATION_COMPLETED,
                    source: "server",
                    actor: {
                        userId: req.user?.uid ?? null,
                        isAnonymous: false,
                    },
                    context: {
                        surface: "owner_registration",
                        route: "/api/v1/users/complete-owner-profile",
                        method: "POST",
                    },
                    resource: {
                        type: "owner_registration",
                        id: "completed",
                        ownerUserId: req.user?.uid ?? null,
                    },
                    meta: {
                        producer: "backend_api",
                    },
                }));
            } catch (err) {
                log.error(`Analytics emit failed (owner_registration_completed): ${err?.message || err}`);
            }
        }

        return ok(res, { message: "Owner profile completed", role: "owner" });
    } catch (err) {
        return fail(res, err.code || "VALIDATION_ERROR", err.message, err.status || 400);
    }
}

/**
 * Applies partial profile updates with owner-specific country restrictions.
 */
export async function updateUserProfile(req, res) {
    const {
        name,
        country,
        phone,
        instagram,
        position,
        appLanguage,
        notificationsEnabled,
    } = req.body || {};

    const updates = {};
    const now = new Date().toISOString();
    const isOwner = req.user?.role === "owner";
    const hasIdentityFieldPatch = [
        name,
        country,
        phone,
        instagram,
        position,
    ].some(value => value !== undefined);

    if (!isOwner && hasIdentityFieldPatch) {
        return fail(
            res,
            "USER_PROFILE_FIELDS_FORBIDDEN",
            "Only language and notification settings can be changed before owner profile registration",
            403
        );
    }

    if (name !== undefined) {
        const trimmedName = String(name ?? "").trim();
        if (!trimmedName) {
            return fail(res, "VALIDATION_ERROR", "Name is required", 400);
        }
        updates.name = trimmedName;
    }

    if (country !== undefined) {
        const trimmedCountry = String(country ?? "").trim();
        if (!trimmedCountry) {
            return fail(res, "COUNTRY_REQUIRED", "Country is required", 400);
        }
        if (isCountryBlocked(trimmedCountry)) {
            return fail(res, "COUNTRY_BLOCKED", "Country is not supported", 403);
        }

        const currentCountry = req.user?.country ?? null;
        if (
            isOwner &&
            normalizeCountry(trimmedCountry) !== normalizeCountry(currentCountry)
        ) {
            const ownerUid = req.auth?.uid || req.user?.uid;
            const hasShowrooms = await ownerHasActiveShowrooms(ownerUid);

            if (hasShowrooms) {
                return fail(
                    res,
                    "USER_COUNTRY_CHANGE_BLOCKED",
                    "To change country, delete your showrooms or create a new account",
                    409
                );
            }
        }

        updates.country = trimmedCountry;
        if (req.user?.onboardingState !== "completed") {
            updates.onboardingState = "completed";
        }
    }

    if (instagram !== undefined || position !== undefined) {
        if (!isOwner) {
            return fail(res, "FORBIDDEN", "Access denied", 403);
        }
    }

    if (phone !== undefined) {
        if (!isOwner) {
            return fail(res, "FORBIDDEN", "Access denied", 403);
        }
    }

    if (phone !== undefined) {
        const trimmedPhone = String(phone ?? "").trim();
        if (!trimmedPhone) {
            return fail(res, "VALIDATION_ERROR", "Phone is required", 400);
        }
        try {
            const { e164 } = validatePhone(trimmedPhone, updates.country ?? req.user?.country ?? null);
            updates["ownerProfile.phone"] = e164;
        } catch (err) {
            return fail(res, err.code || "VALIDATION_ERROR", err.message, err.status || 400);
        }
    }

    if (instagram !== undefined) {
        const trimmedInstagram = String(instagram ?? "").trim();
        if (!trimmedInstagram) {
            return fail(res, "VALIDATION_ERROR", "Instagram is required", 400);
        }
        try {
            const normalizedInstagram = normalizeInstagramUrl(trimmedInstagram);
            validateInstagramUrl(normalizedInstagram);
            updates["ownerProfile.instagram"] = normalizedInstagram;
        } catch (err) {
            return fail(res, err.code || "VALIDATION_ERROR", err.message, err.status || 400);
        }
    }

    if (position !== undefined) {
        const trimmedPosition = position ? String(position).trim() : null;
        updates["ownerProfile.position"] = trimmedPosition || null;
    }

    if (appLanguage !== undefined) {
        updates.appLanguage = normalizeAppLanguage(appLanguage);
    }

    if (notificationsEnabled !== undefined) {
        updates.notificationsEnabled = notificationsEnabled;
    }

    if (updates.name && isOwner) {
        updates["ownerProfile.name"] = updates.name;
    }

    updates.updatedAt = now;

    await updateUserProfileDoc(req.user.uid, updates);

    return ok(res, { message: "Profile updated" });
}
