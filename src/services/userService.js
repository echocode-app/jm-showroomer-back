import { getFirestoreInstance } from "../config/firebase.js";
import { ROLES } from "../constants/roles.js";

/**
 * ADMIN → approve OWNER request
 */
export async function approveOwnerRole(userId, adminId) {
    const db = getFirestoreInstance();
    const ref = db.collection("users").doc(userId);

    await ref.update({
        role: ROLES.OWNER,
        "roleRequest.status": "approved",
        "roleRequest.reviewedAt": new Date().toISOString(),
        "roleRequest.reviewedBy": adminId,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * ADMIN → reject OWNER request
 */
export async function rejectOwnerRole(userId, adminId, reason = null) {
    const db = getFirestoreInstance();
    const ref = db.collection("users").doc(userId);

    await ref.update({
        "roleRequest.status": "rejected",
        "roleRequest.reviewedAt": new Date().toISOString(),
        "roleRequest.reviewedBy": adminId,
        "roleRequest.reason": reason,
        updatedAt: new Date().toISOString(),
    });
}
