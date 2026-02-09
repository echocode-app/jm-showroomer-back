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

export function buildDomainError(code) {
    const err = new Error(getMessageForCode(code, code));
    err.code = code;
    err.status = getStatusForCode(code) ?? 500;
    return err;
}
