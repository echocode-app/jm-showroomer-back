import { ok } from "../../utils/apiResponse.js";
import { deleteUserDevice, upsertUserDevice } from "../../services/users/deviceService.js";

export async function registerMyDevice(req, res, next) {
    try {
        await upsertUserDevice(req.auth.uid, req.body);
        return ok(res, { success: true });
    } catch (err) {
        next(err);
    }
}

export async function deleteMyDevice(req, res, next) {
    try {
        await deleteUserDevice(req.auth.uid, req.params.deviceId);
        return ok(res, { success: true });
    } catch (err) {
        next(err);
    }
}
