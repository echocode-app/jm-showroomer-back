import { isCountryBlocked, normalizeCountry } from "../constants/countries.js";
import { ok, fail } from "../utils/apiResponse.js";
import {
    normalizeInstagramUrl,
    validateInstagramUrl,
} from "../utils/showroomValidation.js";
import {
    updateUserOnboarding,
    updateOwnerProfile,
    updateUserProfileDoc,
    makeOwnerDevUser,
    ownerHasActiveShowrooms,
    ownerHasLookbooks,
    ownerHasEvents,
} from "../services/users/profileService.js";

// getMyProfile
export async function getMyProfile(req, res) {
    return ok(res, req.user);
}

// completeOnboarding
export async function completeOnboarding(req, res) {
    const { country } = req.body;

    if (!country) {
        return fail(res, "COUNTRY_REQUIRED", "Country is required", 400);
    }

    if (isCountryBlocked(country)) {
        return fail(res, "COUNTRY_BLOCKED", "Country is not supported", 403);
    }

    if (req.user.onboardingState === "completed") {
        return ok(res, { message: "Onboarding already completed" });
    }

    await updateUserOnboarding(req.user.uid, country);

    return ok(res, { message: "Onboarding completed" });
}

// completeOwnerProfile
export async function completeOwnerProfile(req, res) {
    const { name, position = null, country, instagram } = req.body || {};

    const trimmedName = String(name ?? "").trim();
    const trimmedCountry = String(country ?? "").trim();
    const trimmedInstagram = String(instagram ?? "").trim();

    if (!trimmedName || !trimmedCountry || !trimmedInstagram) {
        return fail(res, "VALIDATION_ERROR", "Missing required fields", 400);
    }

    if (isCountryBlocked(trimmedCountry)) {
        return fail(res, "COUNTRY_BLOCKED", "Country is not supported", 403);
    }

    try {
        const normalizedInstagram = normalizeInstagramUrl(trimmedInstagram);
        validateInstagramUrl(normalizedInstagram);

        const now = new Date().toISOString();
        const ownerProfile = {
            name: trimmedName,
            position: position ? String(position).trim() : null,
            instagram: normalizedInstagram,
        };

        await updateOwnerProfile(req.user.uid, {
            name: trimmedName,
            country: trimmedCountry,
            ownerProfile,
            updatedAt: now,
        });

        return ok(res, { message: "Owner profile completed", role: "owner" });
    } catch (err) {
        return fail(res, err.code || "VALIDATION_ERROR", err.message, err.status || 400);
    }
}

// updateUserProfile
export async function updateUserProfile(req, res) {
    const {
        name,
        country,
        instagram,
        position,
        appLanguage,
        notificationsEnabled,
    } = req.body || {};

    const updates = {};
    const now = new Date().toISOString();

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
            req.user?.role === "owner" &&
            normalizeCountry(trimmedCountry) !== normalizeCountry(currentCountry)
        ) {
            const [hasShowrooms, hasLookbooks, hasEvents] = await Promise.all([
                ownerHasActiveShowrooms(req.user.uid),
                ownerHasLookbooks(req.user.uid),
                ownerHasEvents(req.user.uid),
            ]);

            if (hasShowrooms || hasLookbooks || hasEvents) {
                return fail(
                    res,
                    "USER_COUNTRY_CHANGE_BLOCKED",
                    "To change country, delete your showrooms and lookbooks or create a new account",
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
        if (req.user?.role !== "owner") {
            return fail(res, "FORBIDDEN", "Access denied", 403);
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
        updates.appLanguage = String(appLanguage).trim();
    }

    if (notificationsEnabled !== undefined) {
        updates.notificationsEnabled = Boolean(notificationsEnabled);
    }

    if (updates.name && req.user?.role === "owner") {
        updates["ownerProfile.name"] = updates.name;
    }

    updates.updatedAt = now;

    await updateUserProfileDoc(req.user.uid, updates);

    return ok(res, { message: "Profile updated" });
}

// makeOwnerDev
export async function makeOwnerDev(req, res) {
    if (process.env.NODE_ENV === "prod") {
        return fail(res, "NOT_FOUND", "Not found", 404);
    }

    await makeOwnerDevUser(req.user.uid);

    return ok(res, { role: "owner" });
}
