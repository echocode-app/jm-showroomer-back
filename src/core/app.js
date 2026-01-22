import express from "express";
import { setupMiddleware } from "./middleware.js";
import { setupRoutes } from "./routes.js";
import { setupErrorHandling } from "./error.js";

const app = express();

setupMiddleware(app);
setupRoutes(app);
setupErrorHandling(app);

app.get("/", (req, res) => {
  res.json({ service: "JM Showroomer API", status: "🚀running" });
});

export default app;
