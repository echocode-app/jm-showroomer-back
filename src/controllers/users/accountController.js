import { ok, fail } from "../../utils/apiResponse.js";
import { getAuthInstance } from "../../config/firebase.js";
import { log } from "../../config/logger.js";
import {
    makeOwnerDevUser,
    getUserById,
    deleteUserAccountWithBlockGuard,
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
 * Soft-deletes current account if there are no blocking owned business entities.
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

    const result = await deleteUserAccountWithBlockGuard(userId);
    if (result.status === "not_found") {
        return fail(res, "USER_NOT_FOUND", "User profile not found", 404);
    }
    if (result.status === "already_deleted") {
        return ok(res, { message: "Account already deleted" });
    }
    if (result.status === "delete_in_progress") {
        return ok(res, { message: "Account deletion in progress" });
    }
    if (result.status === "blocked") {
        return fail(
            res,
            "USER_DELETE_BLOCKED",
            "Resolve owned business entities before deleting your account.",
            409
        );
    }

    try {
        await getAuthInstance().revokeRefreshTokens(userId);
    } catch (err) {
        log.error(`USER_DELETE_REVOKE_FAILED uid=${userId}: ${err?.message || err}`);
    }

    return ok(res, { message: "Account deleted" });
}
