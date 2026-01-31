import { requestOwnerRole as requestOwnerRoleService } from "../services/userService.js";
import { isCountryBlocked } from "../constants/countries.js";
import { ok, fail } from "../utils/apiResponse.js";
import { getFirestoreInstance } from "../config/firebase.js";

/**
 * GET current user profile
 */
export async function getMyProfile(req, res) {
    return ok(res, req.user);
}

/**
 * REQUEST OWNER ROLE
 */
export async function requestOwnerRole(req, res) {
    await requestOwnerRoleService(req.user.uid);

    return ok(res, { message: "Owner role request submitted" });
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
