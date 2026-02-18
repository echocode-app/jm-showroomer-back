import { getFirestoreInstance } from "../../config/firebase.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { log } from "../../config/logger.js";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { appendHistory, makeHistoryEntry } from "./_helpers.js";
import { createNotification } from "../notifications/notificationService.js";
import { NOTIFICATION_TYPES } from "../notifications/types.js";
import { DEV_STORE, useDevMock } from "./_store.js";

/**
 * Rejects a pending showroom and stores moderation reason + audit trace.
 */
export async function rejectShowroomService(id, reason, user) {
    if (user?.role !== "admin") {
        throw forbidden("ACCESS_DENIED");
    }

    if (!reason) {
        throw badRequest("VALIDATION_ERROR");
    }

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");
        if (showroom.status !== "pending") {
            throw badRequest("SHOWROOM_NOT_EDITABLE");
        }

        const statusBefore = showroom.status;
        showroom.status = "rejected";
        showroom.reviewedAt = new Date().toISOString();
        showroom.reviewedBy = { uid: user.uid, role: user.role };
        showroom.reviewReason = reason;
        showroom.pendingSnapshot = null;
        showroom.updatedAt = showroom.reviewedAt;
        showroom.editHistory = appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "reject",
                actor: user,
                statusBefore,
                statusAfter: showroom.status,
                changedFields: ["status"],
                diff: {
                    status: { from: statusBefore, to: showroom.status },
                },
                at: showroom.updatedAt,
            })
        );
        try {
            await createNotification({
                targetUid: showroom.ownerUid ?? null,
                actorUid: user.uid,
                type: NOTIFICATION_TYPES.SHOWROOM_REJECTED,
                resourceType: "showroom",
                resourceId: id,
                payload: {
                    showroomName: showroom.name ?? null,
                    reason,
                },
                dedupeKey: `showroom:${id}:rejected`,
            });
        } catch (err) {
            log.error(`Notification write skipped (reject ${id}): ${err?.message || err}`);
        }

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

        const statusBefore = showroom.status;
        const updates = buildRejectUpdates(showroom, reason, user, statusBefore);
        tx.update(ref, updates);
        try {
            await createNotification({
                targetUid: showroom.ownerUid,
                actorUid: user.uid,
                type: NOTIFICATION_TYPES.SHOWROOM_REJECTED,
                resourceType: "showroom",
                resourceId: id,
                payload: {
                    showroomName: showroom.name ?? null,
                    reason,
                },
                dedupeKey: `showroom:${id}:rejected`,
                tx,
            });
        } catch (err) {
            log.error(`Notification write skipped (reject ${id}): ${err?.message || err}`);
        }
    });

    return { statusChanged: true };
}

/**
 * Builds one atomic reject update payload for Firestore.
 */
function buildRejectUpdates(showroom, reason, user, statusBefore) {
    const historyAt = Timestamp.fromDate(new Date());
    return {
        status: "rejected",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: { uid: user.uid, role: user.role },
        reviewReason: reason,
        pendingSnapshot: null,
        updatedAt: FieldValue.serverTimestamp(),
        editHistory: appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "reject",
                actor: user,
                statusBefore,
                statusAfter: "rejected",
                changedFields: ["status"],
                diff: {
                    status: { from: statusBefore, to: "rejected" },
                },
                at: historyAt,
            })
        ),
    };
}
