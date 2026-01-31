export function ok(res, data = {}, meta = {}) {
    return res.status(200).json({
        success: true,
        data,
        meta,
    });
}

export function created(res, data = {}) {
    return res.status(201).json({
        success: true,
        data,
    });
}

import { getMessageForCode, getStatusForCode } from "../core/errorCodes.js";

export function fail(res, code, message, status = 400) {
    const finalStatus = getStatusForCode(code) ?? status;
    const finalMessage = getMessageForCode(code, message);
    return res.status(finalStatus).json({
        success: false,
        error: {
            code,
            message: finalMessage,
        },
    });
}

export function error(res, code = "INTERNAL_ERROR", message = "Internal error", status = 500) {
    return res.status(status).json({ error: { code, message } });
}
