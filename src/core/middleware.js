import express from "express";
import cors from "cors";
import morgan from "morgan";
import { requestLogger } from "../middlewares/requestLogger.js";
import { CONFIG } from "../config/index.js";

export function setupMiddleware(app) {
    app.use(cors({
        origin: CONFIG.allowedOrigins,
        credentials: true,
    }));
    app.use(express.json());
    app.use(morgan("dev"));
    app.use(requestLogger);
}
