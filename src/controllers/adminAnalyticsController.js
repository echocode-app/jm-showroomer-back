// Admin analytics controllers (read-only).
// Responsibility: parse request query via service layer and return standard ok() envelope.

import {
    getShowroomsAnalyticsService,
    getEventsAnalyticsService,
    getPlatformAnalyticsService,
} from "../services/admin/adminAnalyticsService.js";
import { ok } from "../utils/apiResponse.js";

/**
 * GET /api/v1/admin/analytics/showrooms
 */
export async function getShowroomsAnalytics(req, res, next) {
    try {
        const data = await getShowroomsAnalyticsService(req.query);
        return ok(res, data);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/admin/analytics/events
 */
export async function getEventsAnalytics(req, res, next) {
    try {
        const data = await getEventsAnalyticsService(req.query);
        return ok(res, data);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/admin/analytics/platform
 */
export async function getPlatformAnalytics(req, res, next) {
    try {
        const data = await getPlatformAnalyticsService(req.query);
        return ok(res, data);
    } catch (err) {
        next(err);
    }
}
