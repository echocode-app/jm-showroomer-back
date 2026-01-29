import { requestOwnerRole as requestOwnerRoleService } from "../services/userService.js";
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
    try {
        const db = getFirestoreInstance();
        const ref = db.collection("users").doc(req.user.uid);

        await ref.set(
            { onboardingState: "completed", updatedAt: new Date().toISOString() },
            { merge: true }
        );

        return ok(res, { message: "Onboarding completed" });
    } catch (err) {
        return fail(res, "COMPLETE_ONBOARDING_ERROR", err.message, 500);
    }
}
