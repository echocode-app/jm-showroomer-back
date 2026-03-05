import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";

import routes from "../routes/index.js";
import { errorHandler } from "../middlewares/error.js";
import { requestLogContextMiddleware } from "../middlewares/requestLogContext.js";
import {
  adminLimiter,
  analyticsLimiter,
  authLimiter,
  rateLimiter,
  sanitizeInput,
  writeLimiter,
} from "../middlewares/rateLimit.js";
import { securityHeadersMiddleware } from "../middlewares/securityHeaders.js";
import { CONFIG } from "../config/index.js";
import { log } from "../config/logger.js";
import { buildPinoHttpConfig } from "../config/pinoHttp.js";

import swaggerUi from "swagger-ui-express";
import path from "path";

// Express
const app = express();
app.disable("x-powered-by");

// Render / any reverse proxy setup
app.set("trust proxy", CONFIG.trustProxy);

// Structured HTTP lifecycle logging (single source of truth)
app.use(
  pinoHttp(buildPinoHttpConfig(log))
);
app.use(securityHeadersMiddleware);

// Serve OpenAPI files for $ref resolution
const docsPath = path.join(process.cwd(), "docs");
app.use("/docs/spec", express.static(docsPath));

if (CONFIG.enableSwagger) {
  // Swagger UI (loads from /docs/spec/openapi.yaml)
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(null, {
      swaggerOptions: {
        url: "/docs/spec/openapi.yaml",
      },
      customCss: `
      /* Soften inline accent chips and prevent overlap in all doc sections. */
      .swagger-ui .markdown code,
      .swagger-ui .renderedMarkdown code,
      .swagger-ui .opblock-description-wrapper code,
      .swagger-ui .parameters-col_description code,
      .swagger-ui .response-col_description code {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: inherit;
        font-family: inherit;
        font-size: 0.96em;
        font-weight: 500;
        padding: 0 4px;
        border-radius: 4px;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-height: 1.45;
        box-decoration-break: clone;
      }
      .swagger-ui .markdown p,
      .swagger-ui .markdown li,
      .swagger-ui .opblock-description-wrapper p,
      .swagger-ui .opblock-description-wrapper li {
        line-height: 1.55;
        overflow-wrap: anywhere;
      }
      .swagger-ui .markdown li {
        margin-bottom: 4px;
      }
      .swagger-ui .opblock-summary-path {
        white-space: normal;
        word-break: break-word;
      }
    `,
    })
  );
}

// Rate limiting (policy-driven and environment configurable)
app.use("/api/v1/analytics/ingest", analyticsLimiter);
app.use("/api/v1/admin", adminLimiter);
app.use("/api/v1/auth/oauth", authLimiter);
app.use("/api/v1", writeLimiter);
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
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-anonymous-id",
    "x-request-id",
    "x-country-code",
    "x-client-version",
  ],
};
const corsMiddleware = cors(corsOptions);

// middleware
// CORS must run before body parsers so browser preflight requests are handled early.
app.use(corsMiddleware);
// Express/router path parser in this stack rejects bare "*" for app.options(...).
// Regex keeps equivalent "all paths" preflight handling without wildcard parsing issues.
app.options(/.*/, corsMiddleware);
app.use(express.json({ limit: CONFIG.httpBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: CONFIG.httpUrlEncodedLimit }));
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
