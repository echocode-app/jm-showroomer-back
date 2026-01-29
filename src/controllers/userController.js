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
 * Handles DEV mocks and production role requests.
 */
export async function requestOwnerRole(req, res) {
    // DEV mode mock
    if (process.env.NODE_ENV === "dev" && req.user?.uid === process.env.DEV_TEST_UID) {
        req.user.roleRequest = {
            role: "owner",
            status: "pending",
            requestedAt: new Date().toISOString(),
        };
        req.user.updatedAt = new Date().toISOString();

        return ok(res, {
            message: "Owner role request submitted (dev mock)",
            user: req.user,
        });
    }

    // Production logic: update Firestore
    await requestOwnerRoleService(req.user.uid);

    return ok(res, {
        message: "Owner role request submitted",
    });
}

/**
 * COMPLETE onboarding
 * Marks onboarding as completed.
 * DEV mock supports local testing.
 */
export async function completeOnboarding(req, res) {
    try {
        // DEV mode mock
        if (process.env.NODE_ENV === "dev" && req.user?.uid === process.env.DEV_TEST_UID) {
            req.user.onboardingState = "completed";
            req.user.updatedAt = new Date().toISOString();

            return ok(res, { message: "Onboarding completed (dev mock)", user: req.user });
        }

        // Production: update Firestore
        const db = getFirestoreInstance();
        const ref = db.collection("users").doc(req.user.uid);

        // Use merge to safely update only onboarding state
        await ref.set(
            { onboardingState: "completed", updatedAt: new Date().toISOString() },
            { merge: true }
        );

        return ok(res, { message: "Onboarding completed" });
    } catch (err) {
        return fail(res, "COMPLETE_ONBOARDING_ERROR", err.message, 500);
    }
}
