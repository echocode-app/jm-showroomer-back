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

export function fail(res, code, message, status = 400) {
    return res.status(status).json({
        success: false,
        error: {
            code,
            message,
        },
    });
}

export function error(res, code = "INTERNAL_ERROR", message = "Internal error", status = 500) {
    return res.status(status).json({ error: { code, message } });
}
