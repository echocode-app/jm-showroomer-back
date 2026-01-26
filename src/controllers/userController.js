import { requestOwnerRole as requestOwnerRoleService } from "../services/userService.js";
import { ok, fail } from "../utils/apiResponse.js";
import { getFirestoreInstance } from "../config/firebase.js";

export async function getMyProfile(req, res) {
    return ok(res, req.user);
}

export async function requestOwnerRole(req, res) {
    // DEV mode mock
    if (process.env.NODE_ENV === "dev" && req.user?.uid === "dev-test-user-123") {
        req.user.role = "pending_owner";
        req.user.roles = ["user", "pending_owner"];
        req.user.updatedAt = new Date().toISOString();

        return ok(res, {
            message: "Owner role request submitted (dev mock)",
            user: req.user,
        });
    }

    // Production logic
    await requestOwnerRoleService(req.user.uid);

    return ok(res, {
        message: "Owner role request submitted",
    });
}


export async function completeOnboarding(req, res) {
    try {
        // DEV mode mock
        if (process.env.NODE_ENV === "dev" && req.user?.uid === "dev-test-user-123") {
            req.user.onboardingState = "completed";
            req.user.updatedAt = new Date().toISOString();

            return ok(res, { message: "Onboarding completed (dev mock)", user: req.user });
        }

        // Production / real update
        const db = getFirestoreInstance();
        const ref = db.collection("users").doc(req.user.uid);

        await ref.update({
            onboardingState: "completed",
            updatedAt: new Date().toISOString(),
        });

        return ok(res, { message: "Onboarding completed" });
    } catch (err) {
        return fail(res, "COMPLETE_ONBOARDING_ERROR", err.message, 500);
    }
}
