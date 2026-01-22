import { errorHandler } from "../middlewares/error.js";

export function setupErrorHandling(app) {
    app.use(errorHandler);
}
