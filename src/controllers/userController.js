import { requestOwnerRole as requestOwnerRoleService } from "../services/userService.js";
import { ok } from "../utils/apiResponse.js";

export async function getMyProfile(req, res) {
    return ok(res, req.user);
}

export async function requestOwnerRole(req, res) {
    await requestOwnerRoleService(req.user.uid);

    return ok(res, {
        message: "Owner role request submitted",
    });
}
