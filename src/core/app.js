import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";

import routes from "../routes/index.js";
import { errorHandler } from "../middlewares/error.js";
import { requestLogContextMiddleware } from "../middlewares/requestLogContext.js";
import { analyticsLimiter, rateLimiter, sanitizeInput } from "../middlewares/rateLimit.js";
import { CONFIG } from "../config/index.js";
import { log } from "../config/logger.js";
import { buildPinoHttpConfig } from "../config/pinoHttp.js";

import swaggerUi from "swagger-ui-express";
import path from "path";

// Express
const app = express();

// Render / any reverse proxy setup
app.set("trust proxy", 1);

// Structured HTTP lifecycle logging (single source of truth)
app.use(
  pinoHttp(buildPinoHttpConfig(log))
);

// Serve OpenAPI files for $ref resolution
const docsPath = path.join(process.cwd(), "docs");
app.use("/docs/spec", express.static(docsPath));

// Swagger UI (loads from /docs/spec/openapi.yaml)
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerOptions: {
      url: "/docs/spec/openapi.yaml",
    },
  })
);

// Rate limiting (100 requests per 15 minutes)
app.use("/api/v1/analytics/ingest", analyticsLimiter);
app.use(rateLimiter);

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser requests (curl, server-to-server, health checks).
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (CONFIG.allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
const corsMiddleware = cors(corsOptions);

// middleware
// CORS must run before body parsers so browser preflight requests are handled early.
app.use(corsMiddleware);
// Express/router path parser in this stack rejects bare "*" for app.options(...).
// Regex keeps equivalent "all paths" preflight handling without wildcard parsing issues.
app.options(/.*/, corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput);
app.use(requestLogContextMiddleware);

// API
app.use("/api/v1", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ service: "JM Showroomer API", status: "🚀running" });
});

// Error handler
app.use(errorHandler);

export default app;
