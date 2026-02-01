import { isCountryBlocked } from "../constants/countries.js";
import { ok, fail } from "../utils/apiResponse.js";
import { getFirestoreInstance } from "../config/firebase.js";
import {
    normalizeInstagramUrl,
    validateInstagramUrl,
    validateShowroomName,
} from "../utils/showroomValidation.js";

/**
 * GET current user profile
 */
export async function getMyProfile(req, res) {
    return ok(res, req.user);
}

/**
 * COMPLETE onboarding
 */

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

    const db = getFirestoreInstance();
    const ref = db.collection("users").doc(req.user.uid);

    await ref.update({
        country,
        onboardingState: "completed",
        updatedAt: new Date().toISOString(),
    });

    return ok(res, { message: "Onboarding completed" });
}

/**
 * COMPLETE owner profile + auto-upgrade to owner
 * Required: name, country, instagram. Optional: position.
 */
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
        validateShowroomName(trimmedName);
        const normalizedInstagram = normalizeInstagramUrl(trimmedInstagram);
        validateInstagramUrl(normalizedInstagram);

        const db = getFirestoreInstance();
        const ref = db.collection("users").doc(req.user.uid);

        const now = new Date().toISOString();
        const ownerProfile = {
            name: trimmedName,
            position: position ? String(position).trim() : null,
            instagram: normalizedInstagram,
        };

        await ref.update({
            name: trimmedName,
            country: trimmedCountry,
            onboardingState: "completed",
            role: "owner",
            roles: ["owner"],
            ownerProfile,
            updatedAt: now,
        });

        return ok(res, { message: "Owner profile completed", role: "owner" });
    } catch (err) {
        return fail(res, err.code || "VALIDATION_ERROR", err.message, err.status || 400);
    }
}

/**
 * DEV: upgrade current user to owner role
 */
export async function makeOwnerDev(req, res) {
    if (process.env.NODE_ENV === "prod") {
        return fail(res, "NOT_FOUND", "Not found", 404);
    }

    const db = getFirestoreInstance();
    const ref = db.collection("users").doc(req.user.uid);

    await ref.update({
        role: "owner",
        roles: ["owner"],
        updatedAt: new Date().toISOString(),
    });

    return ok(res, { role: "owner" });
}
