import { errorHandler } from "../middlewares/error.js";

export function setupErrorHandling(app) {
    app.use(errorHandler);
}

export function badRequest(message = "Bad request") {
    const err = new Error(message);
    err.status = 400;
    err.code = message;
    return err;
}

export function notFound(message = "Not found") {
    const err = new Error(message);
    err.status = 404;
    err.code = message;
    return err;
}

export function forbidden(message = "Forbidden") {
    const err = new Error(message);
    err.status = 403;
    err.code = message;
    return err;
}
