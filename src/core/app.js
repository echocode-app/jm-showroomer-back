import express from "express";
import cors from "cors";
import morgan from "morgan";

import routes from "../routes/index.js";
import { errorHandler } from "../middlewares/error.js";
import { requestLogger } from "../middlewares/requestLogger.js";
import { rateLimiter, sanitizeInput } from "../middlewares/rateLimit.js";
import { CONFIG } from "../config/index.js";

import swaggerUi from "swagger-ui-express";
import path from "path";

// Express
const app = express();

// Render / any reverse proxy setup
app.set("trust proxy", 1);

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
app.use(morgan("dev"));
app.use(requestLogger);

// API
app.use("/api/v1", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ service: "JM Showroomer API", status: "🚀running" });
});

// Error handler
app.use(errorHandler);

export default app;
