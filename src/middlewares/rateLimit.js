import rateLimit from "express-rate-limit";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 100;

const ENV = process.env.NODE_ENV || "dev";
const RATE_LIMITS = {
    dev: { windowMs: 5 * 60 * 1000, max: 2000 },
    test: { windowMs: 5 * 60 * 1000, max: 2000 },
    prod: { windowMs: DEFAULT_WINDOW_MS, max: 300 },
};

const { windowMs, max } = RATE_LIMITS[ENV] || {
    windowMs: DEFAULT_WINDOW_MS,
    max: DEFAULT_MAX,
};

const rateLimiter = rateLimit({
    windowMs,
    max,
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
        res.status(429).json(options.message);
    },
});

// Export rateLimiter for direct use
export { rateLimiter };

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
