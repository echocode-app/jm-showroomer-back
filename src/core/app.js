import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import pinoHttp from "pino-http";

import routes from "../routes/index.js";
import { errorHandler } from "../middlewares/error.js";
import { requestLogContextMiddleware } from "../middlewares/requestLogContext.js";
import { rateLimiter, sanitizeInput } from "../middlewares/rateLimit.js";
import { CONFIG } from "../config/index.js";
import { log } from "../config/logger.js";

import swaggerUi from "swagger-ui-express";
import path from "path";

// Express
const app = express();

// Render / any reverse proxy setup
app.set("trust proxy", 1);

// Structured HTTP lifecycle logging (single source of truth)
app.use(
  pinoHttp({
    logger: log,
    genReqId(req, res) {
      const incoming = req.headers["x-request-id"];
      const requestId =
        typeof incoming === "string" && incoming.trim()
          ? incoming
          : crypto.randomUUID();
      res.setHeader("x-request-id", requestId);
      return requestId;
    },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customProps(req) {
      return {
        requestId: req.id,
      };
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body",
      ],
      remove: true,
    },
    autoLogging: {
      ignore(req) {
        return req.url?.startsWith("/health") || req.url?.startsWith("/api/v1/health");
      },
    },
  })
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
app.use(rateLimiter);

// Input sanitization
app.use(sanitizeInput);

// middleware
app.use(cors({
  origin: CONFIG.allowedOrigins || "*",
  credentials: true,
}));
app.use(express.json());
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
