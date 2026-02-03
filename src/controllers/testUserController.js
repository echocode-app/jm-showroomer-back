import { createTestUser } from "../services/testUserService.js";
import { ok } from "../utils/apiResponse.js";

// registerTestUser
export async function registerTestUser(req, res, next) {
    try {
        const user = await createTestUser();
        return ok(res, { user });
    } catch (err) {
        next(err);
    }
}

