import { errorHandler } from "../middlewares/error.js";
import { getMessageForCode, getStatusForCode } from "./errorCodes.js";

// setupErrorHandling
export function setupErrorHandling(app) {
    app.use(errorHandler);
}

// buildError
function buildError(code, defaultStatus) {
    const status = getStatusForCode(code) ?? defaultStatus;
    const message = getMessageForCode(code, code);
    const err = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

// badRequest
export function badRequest(message = "Bad request") {
    return buildError(message, 400);
}

// notFound
export function notFound(message = "Not found") {
    return buildError(message, 404);
}

// forbidden
export function forbidden(message = "Forbidden") {
    return buildError(message, 403);
}
