import { ok } from "../../utils/apiResponse.js";
import {
    getUnreadNotificationsCount,
    listUserNotifications,
    markNotificationRead,
} from "../../services/notifications/readService.js";

export async function listMyNotifications(req, res, next) {
    try {
        const uid = req.auth.uid;
        const { items, meta } = await listUserNotifications(uid, req.query ?? {});
        return ok(res, { items, meta });
    } catch (err) {
        next(err);
    }
}

export async function markMyNotificationRead(req, res, next) {
    try {
        const uid = req.auth.uid;
        const result = await markNotificationRead(uid, req.params.notificationId);
        return ok(res, result);
    } catch (err) {
        next(err);
    }
}

export async function getMyUnreadNotificationsCount(req, res, next) {
    try {
        const uid = req.auth.uid;
        const unreadCount = await getUnreadNotificationsCount(uid);
        return ok(res, { unreadCount });
    } catch (err) {
        next(err);
    }
}
