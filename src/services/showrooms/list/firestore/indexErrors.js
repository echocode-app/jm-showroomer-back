// Firestore index error mapping to domain error.

import { getMessageForCode, getStatusForCode } from "../../../../core/errorCodes.js";

export function isIndexNotReadyError(err) {
    if (!err) return false;
    const code = err.code;
    const message = String(err.message ?? "").toLowerCase();
    return (
        code === 9 ||
        code === "FAILED_PRECONDITION" ||
        message.includes("failed_precondition")
    ) && message.includes("requires an index");
}

export function buildDomainError(code, meta, cause = null) {
    const err = new Error(getMessageForCode(code, code));
    err.code = code;
    err.status = getStatusForCode(code) ?? 500;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        err.meta = { ...meta };
    }
    if (cause) {
        const firestoreMessage = String(cause?.message || "").trim();
        if (firestoreMessage) {
            err.meta = {
                ...(err.meta && typeof err.meta === "object" ? err.meta : {}),
                firestoreMessage,
            };
        }
    }
    return err;
}
