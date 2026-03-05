import rateLimit from "express-rate-limit";
import { logDomainEvent } from "../utils/logDomainEvent.js";
import { classifyError } from "../utils/errorClassifier.js";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 100;

const ENV = process.env.NODE_ENV || "dev";
const isProd = ENV === "prod";

function parseIntEnv(name, defaultValue, min = 1) {
    const value = Number(process.env[name]);
    if (!Number.isInteger(value)) return defaultValue;
    return Math.max(min, value);
}

const GLOBAL_LIMITS = {
    windowMs: parseIntEnv("RATE_LIMIT_GLOBAL_WINDOW_MS", isProd ? DEFAULT_WINDOW_MS : 5 * 60 * 1000),
    max: parseIntEnv("RATE_LIMIT_GLOBAL_MAX", isProd ? 600 : 3000),
};

const ANALYTICS_LIMITS = {
    windowMs: parseIntEnv("RATE_LIMIT_ANALYTICS_WINDOW_MS", 5 * 60 * 1000),
    max: parseIntEnv("RATE_LIMIT_ANALYTICS_MAX", isProd ? 2500 : 8000),
};

const ADMIN_LIMITS = {
    windowMs: parseIntEnv("RATE_LIMIT_ADMIN_WINDOW_MS", 15 * 60 * 1000),
    max: parseIntEnv("RATE_LIMIT_ADMIN_MAX", isProd ? 1200 : 6000),
};

const AUTH_LIMITS = {
    windowMs: parseIntEnv("RATE_LIMIT_AUTH_WINDOW_MS", 15 * 60 * 1000),
    max: parseIntEnv("RATE_LIMIT_AUTH_MAX", isProd ? 80 : 500),
};

const WRITE_LIMITS = {
    windowMs: parseIntEnv("RATE_LIMIT_WRITE_WINDOW_MS", 15 * 60 * 1000),
    max: parseIntEnv("RATE_LIMIT_WRITE_MAX", isProd ? 400 : 3000),
};

function isAnalyticsIngestPath(req) {
    const path = String(req?.originalUrl || req?.url || "");
    return path.startsWith("/api/v1/analytics/ingest");
}

function isAdminPath(req) {
    const path = String(req?.originalUrl || req?.url || "");
    return path.startsWith("/api/v1/admin");
}

function isAuthOauthPath(req) {
    const path = String(req?.originalUrl || req?.url || "");
    return path.startsWith("/api/v1/auth/oauth");
}

function isMutationMethod(req) {
    const method = String(req?.method || "GET").toUpperCase();
    return ["POST", "PATCH", "PUT", "DELETE"].includes(method);
}

function isDocsOrHealthPath(req) {
    const path = String(req?.originalUrl || req?.url || "");
    return (
        path === "/" ||
        path.startsWith("/docs") ||
        path.startsWith("/api/v1/health") ||
        path.startsWith("/health")
    );
}

function buildLimiter({ windowMs, max, skip, name }) {
    return rateLimit({
        windowMs,
        max,
        skip,
        message: {
            success: false,
            error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Too many requests, please try again later",
            },
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res, next, options) => {
            const { level } = classifyError({ code: "RATE_LIMIT_EXCEEDED", status: 429 });
            logDomainEvent(req, {
                domain: "system",
                event: "rate_limit",
                status: "blocked",
                meta: {
                    route: req.baseUrl ? `${req.baseUrl}${req.path || ""}` : (req.path || req.url),
                    limit: `${name}:${max}/${windowMs}ms`,
                },
            }, level);
            res.status(429).json(options.message);
        },
    });
}

const analyticsLimiter = buildLimiter({
    windowMs: ANALYTICS_LIMITS.windowMs,
    max: ANALYTICS_LIMITS.max,
    name: "analytics",
});

const rateLimiter = buildLimiter({
    windowMs: GLOBAL_LIMITS.windowMs,
    max: GLOBAL_LIMITS.max,
    skip: req => isAnalyticsIngestPath(req) || isDocsOrHealthPath(req),
    name: "global",
});

const adminLimiter = buildLimiter({
    windowMs: ADMIN_LIMITS.windowMs,
    max: ADMIN_LIMITS.max,
    skip: req => isAnalyticsIngestPath(req) || !isAdminPath(req),
    name: "admin",
});

const authLimiter = buildLimiter({
    windowMs: AUTH_LIMITS.windowMs,
    max: AUTH_LIMITS.max,
    skip: req => !isAuthOauthPath(req),
    name: "auth",
});

const writeLimiter = buildLimiter({
    windowMs: WRITE_LIMITS.windowMs,
    max: WRITE_LIMITS.max,
    skip: req =>
        isAnalyticsIngestPath(req) ||
        isDocsOrHealthPath(req) ||
        !isMutationMethod(req) ||
        isAuthOauthPath(req),
    name: "write",
});

// Export rateLimiter for direct use
export { analyticsLimiter, rateLimiter, adminLimiter, authLimiter, writeLimiter };

// Keep old function signature for backwards compatibility
export function createRateLimiter() {
    return rateLimiter;
}

/**
 * Custom input sanitization for Firebase/Firestore
 * Removes potentially dangerous characters and patterns
 */
// sanitizeInput
export function sanitizeInput(req, res, next) {
// sanitize
    const sanitize = (obj, depth = 0) => {
        if (depth > 5) return obj;
        if (!obj || typeof obj !== "object") return obj;

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "string") {
                // Remove dangerous patterns
                let sanitizedValue = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                    .replace(/javascript:/gi, "")
                    .replace(/on\w+=/gi, "")
                    .replace(/\$\{/g, "")
                    .replace(/<[^>]*>/g, "")
                    .trim();

                // Limit string length
                if (sanitizedValue.length > 10000) {
                    sanitizedValue = sanitizedValue.substring(0, 10000);
                }

                sanitized[key] = sanitizedValue;
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map((item) =>
                    typeof item === "string"
                        ? item
                            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                            .replace(/javascript:/gi, "")
                            .replace(/on\w+=/gi, "")
                            .replace(/\$\{/g, "")
                            .replace(/<[^>]*>/g, "")
                            .trim()
                        : sanitize(item, depth + 1)
                );
            } else if (typeof value === "object") {
                sanitized[key] = sanitize(value, depth + 1);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };

    if (req.body && Object.keys(req.body).length > 0) {
        req.body = sanitize(req.body);
    }

    if (req.query && Object.keys(req.query).length > 0) {
        Object.assign(req.query, sanitize(req.query));
    }

    next();
}
