import { getAdminOverviewService } from "../services/admin/adminOverviewService.js";
import { ok } from "../utils/apiResponse.js";

export async function getAdminOverview(req, res, next) {
    try {
        const overview = await getAdminOverviewService();
        return ok(res, overview);
    } catch (err) {
        next(err);
    }
}
