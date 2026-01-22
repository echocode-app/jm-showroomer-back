import express from "express";
import cors from "cors";
import morgan from "morgan";

import routes from "../routes/index.js";
import { errorHandler } from "../middlewares/error.js";
import { requestLogger } from "../middlewares/requestLogger.js";
import { CONFIG } from "../config/index.js";

const app = express();

// Middleware
app.use(cors({
  origin: CONFIG.allowedOrigins || "*",
  credentials: true,
}));
app.use(express.json());
app.use(morgan("dev"));
app.use(requestLogger);

// API versioning
app.use("/api/v1", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ service: "JM Showroomer API", status: "🚀running" });
});

// Error handler
app.use(errorHandler);

export default app;
