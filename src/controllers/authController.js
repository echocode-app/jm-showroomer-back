import { verifyOAuthToken } from "../services/authService.js";
import { ok, fail } from "../utils/apiResponse.js";
import { log } from "../config/logger.js";
import { buildAnalyticsEvent } from "../services/analytics/analyticsEventBuilder.js";
import { record } from "../services/analytics/analyticsEventService.js";
import { ANALYTICS_EVENTS } from "../services/analytics/eventNames.js";
import { logDomainEvent } from "../utils/logDomainEvent.js";
import { classifyError } from "../utils/errorClassifier.js";

// oauthLogin
export async function oauthLogin(req, res, next) {
    try {
        const { idToken } = req.body;
        const { user, signInProvider } = await verifyOAuthToken(idToken);
        log.info(`firebase.sign_in_provider: ${signInProvider || "unknown"}`);
        try {
            await record(buildAnalyticsEvent({
                eventName: ANALYTICS_EVENTS.AUTH_COMPLETED,
                source: "server",
                actor: {
                    userId: user?.uid ?? null,
                    isAnonymous: false,
                },
                context: {
                    surface: "auth",
                    route: "/api/v1/auth/oauth",
                    method: "POST",
                },
                resource: {
                    type: "auth",
                    id: signInProvider || "unknown",
                    attributes: {
                        provider: signInProvider || "unknown",
                    },
                },
                meta: {
                    producer: "backend_api",
                },
            }));
        } catch (e) {
            log.error(`Analytics emit failed (auth_completed): ${e?.message || e}`);
        }

        logDomainEvent.info(req, {
            domain: "auth",
            event: "login",
            status: "success",
        });

        return ok(res, { user });
    } catch (err) {
        try {
            await record(buildAnalyticsEvent({
                eventName: ANALYTICS_EVENTS.AUTH_FAILED,
                source: "server",
                actor: {
                    userId: null,
                    isAnonymous: true,
                },
                context: {
                    surface: "auth",
                    route: "/api/v1/auth/oauth",
                    method: "POST",
                },
                resource: {
                    type: "auth",
                    id: "unknown",
                    attributes: {
                        provider: "unknown",
                        errorCode: err?.code || "AUTH_ERROR",
                    },
                },
                meta: {
                    producer: "backend_api",
                },
            }));
        } catch (e) {
            log.error(`Analytics emit failed (auth_failed): ${e?.message || e}`);
        }

        const { level, category } = classifyError(err);

        logDomainEvent(req, {
            domain: "auth",
            event: "login",
            status: "failed",
            meta: {
                code: err?.code || "AUTH_ERROR",
                category,
            },
        }, level, err);

        return fail(res, err.code || "AUTH_ERROR", err.message, err.status);
    }
}
