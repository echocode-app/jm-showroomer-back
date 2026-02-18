import { getFirestoreInstance } from "../../config/firebase.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { EDITABLE_FIELDS } from "./_constants.js";
import { appendHistory, buildDiff, makeHistoryEntry } from "./_helpers.js";
import { DEV_STORE, useDevMock } from "./_store.js";

// approveShowroomService
export async function approveShowroomService(id, user) {
    if (user?.role !== "admin") {
        throw forbidden("ACCESS_DENIED");
    }

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");
        if (showroom.status !== "pending") {
            throw badRequest("SHOWROOM_NOT_EDITABLE");
        }

        if (!showroom.pendingSnapshot) {
            throw badRequest("SHOWROOM_PENDING_SNAPSHOT_MISSING");
        }
        // Apply immutable pending snapshot to prevent post-submit drift.
        const snapshot = showroom.pendingSnapshot;
        const applied = { ...showroom, ...snapshot };
        const { diff, changedFields } = buildDiff(showroom, applied, EDITABLE_FIELDS);

        changedFields.forEach(field => {
            showroom[field] = diff[field].to;
        });

        const statusBefore = showroom.status;
        showroom.status = "approved";
        showroom.reviewedAt = new Date().toISOString();
        showroom.reviewedBy = { uid: user.uid, role: user.role };
        showroom.pendingSnapshot = null;
        showroom.updatedAt = showroom.reviewedAt;
        showroom.editHistory = appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "approve",
                actor: user,
                statusBefore,
                statusAfter: showroom.status,
                changedFields,
                diff,
                at: showroom.updatedAt,
            })
        );

        return { statusChanged: true };
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

        const showroom = snap.data();
        if (showroom.status !== "pending") {
            throw badRequest("SHOWROOM_NOT_EDITABLE");
        }

        if (!showroom.pendingSnapshot) {
            throw badRequest("SHOWROOM_PENDING_SNAPSHOT_MISSING");
        }

        // Apply immutable pending snapshot to prevent post-submit drift.
        const snapshot = showroom.pendingSnapshot;
        const applied = { ...showroom, ...snapshot };
        const { diff, changedFields } = buildDiff(showroom, applied, EDITABLE_FIELDS);

        const updates = {};
        changedFields.forEach(field => {
            updates[field] = diff[field].to;
        });

        const statusBefore = showroom.status;
        const historyAt = Timestamp.fromDate(new Date());
        updates.status = "approved";
        updates.reviewedAt = FieldValue.serverTimestamp();
        updates.reviewedBy = { uid: user.uid, role: user.role };
        updates.pendingSnapshot = null;
        updates.updatedAt = FieldValue.serverTimestamp();
        updates.editHistory = appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "approve",
                actor: user,
                statusBefore,
                statusAfter: "approved",
                changedFields,
                diff,
                at: historyAt,
            })
        );

        tx.update(ref, updates);
    });

    return { statusChanged: true };
}
