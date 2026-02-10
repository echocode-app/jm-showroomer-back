import { createTestUser } from "../services/testUserService.js";
import { ok, fail } from "../utils/apiResponse.js";

// registerTestUser
export async function registerTestUser(req, res, next) {
    try {
        if (process.env.NODE_ENV === "prod") {
            return fail(res, "NOT_FOUND", "Not found", 404);
        }

        const user = await createTestUser();
        return ok(res, { user });
    } catch (err) {
        next(err);
    }
}
