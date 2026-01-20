import { createTestUser } from "../services/userService.js";
import { ok } from "../utils/apiResponse.js";

export async function registerTestUser(req, res, next) {
    try {
        const user = await createTestUser();
        return ok(res, { user });
    } catch (err) {
        next(err);
    }
}
