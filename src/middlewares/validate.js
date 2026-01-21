import { fail } from "../utils/apiResponse.js";

export function validateBody(fields) {
    return (req, res, next) => {
        for (const field of fields) {
            if (!req.body[field]) {
                return fail(res, "VALIDATION_ERROR", `Missing field: ${field}`, 400);
            }
        }
        next();
    };
}

export function validateParam(paramName) {
    return (req, res, next) => {
        if (!req.params[paramName]) {
            return fail(res, "VALIDATION_ERROR", `Missing param: ${paramName}`, 400);
        }
        next();
    };
}
