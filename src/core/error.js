import { errorHandler } from "../middlewares/error.js";
import { getMessageForCode, getStatusForCode } from "./errorCodes.js";

export function setupErrorHandling(app) {
    app.use(errorHandler);
}

function buildError(code, defaultStatus) {
    const status = getStatusForCode(code) ?? defaultStatus;
    const message = getMessageForCode(code, code);
    const err = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

export function badRequest(message = "Bad request") {
    return buildError(message, 400);
}

export function notFound(message = "Not found") {
    return buildError(message, 404);
}

export function forbidden(message = "Forbidden") {
    return buildError(message, 403);
}
