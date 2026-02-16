import { ok, fail } from "../../utils/apiResponse.js";
import {
    makeOwnerDevUser,
    ownerHasActiveShowrooms,
    ownerHasLookbooks,
    ownerHasEvents,
    getUserById,
    softDeleteUserProfile,
} from "../../services/users/profileService.js";

/**
 * Dev-only endpoint to grant owner role for local/manual testing.
 */
export async function makeOwnerDev(req, res) {
    if (process.env.NODE_ENV === "prod") {
        return fail(res, "NOT_FOUND", "Not found", 404);
    }

    await makeOwnerDevUser(req.user.uid);

    return ok(res, { role: "owner" });
}

/**
 * Soft-deletes current account if there are no blocking owner assets.
 */
export async function deleteMyProfile(req, res) {
    const userId = req.auth?.uid;
    if (!userId) {
        return fail(res, "NO_AUTH", "Auth info missing", 401);
    }

    const user = await getUserById(userId);
    if (!user) {
        return fail(res, "USER_NOT_FOUND", "User profile not found", 404);
    }

    if (user.isDeleted) {
        return ok(res, { message: "Account already deleted" });
    }

    if (user.role === "owner") {
        const [hasShowrooms, hasLookbooks, hasEvents] = await Promise.all([
            ownerHasActiveShowrooms(userId),
            ownerHasLookbooks(userId),
            ownerHasEvents(userId),
        ]);

        if (hasShowrooms || hasLookbooks || hasEvents) {
            return fail(
                res,
                "USER_DELETE_BLOCKED",
                "Delete your showrooms before deleting your account.",
                409
            );
        }
    }

    await softDeleteUserProfile(userId);

    return ok(res, { message: "Account deleted" });
}
