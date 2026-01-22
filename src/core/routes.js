import routes from "../routes/index.js";

export function setupRoutes(app) {
    app.use("/api/v1", routes);
}
