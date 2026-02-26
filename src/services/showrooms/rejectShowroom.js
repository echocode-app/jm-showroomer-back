import { getFirestoreInstance } from "../../config/firebase.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { log } from "../../config/logger.js";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { appendHistory, makeHistoryEntry } from "./_helpers.js";
import { createNotification } from "../notifications/notificationService.js";
import { NOTIFICATION_TYPES } from "../notifications/types.js";
import { assertUserWritable, assertUserWritableInTx } from "../users/writeGuardService.js";
import { DEV_STORE, useDevMock } from "./_store.js";

/**
 * Rejects a pending showroom and stores moderation reason + audit trace.
 */
export async function rejectShowroomService(id, reason, user) {
    if (user?.uid) {
        await assertUserWritable(user.uid);
    }
    if (user?.role !== "admin") {
        throw forbidden("ACCESS_DENIED");
    }

    const normalizedReason =
        typeof reason === "string" ? reason.trim() : "";

    if (normalizedReason.length < 3) {
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
        showroom.reviewReason = normalizedReason;
        showroom.pendingSnapshot = null;
        showroom.updatedAt = showroom.reviewedAt;
        showroom.editCount = (showroom.editCount || 0) + 1;
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
                    reason: normalizedReason,
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
    let notificationDraft = null;

    // =========================
    // SECTION: Atomic Moderation
    // =========================
    // Transaction boundary:
    // reject transition and audit history must be committed together.
    // No push inside tx:
    // notification side effects are emitted only after commit.
    // Derived fields assumed already normalized:
    // reject flow does not mutate derived showroom identity/search fields.
    // Snapshot immutable after pending:
    // pendingSnapshot is only cleared during moderation.
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, user.uid);
        const snap = await tx.get(ref);
        if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

        const showroom = snap.data();
        if (showroom.status !== "pending") {
            throw badRequest("SHOWROOM_NOT_EDITABLE");
        }

        const statusBefore = showroom.status;
        const updates = buildRejectUpdates(showroom, normalizedReason, user, statusBefore);
        tx.update(ref, updates);
        notificationDraft = {
            targetUid: showroom.ownerUid,
            actorUid: user.uid,
            type: NOTIFICATION_TYPES.SHOWROOM_REJECTED,
            resourceType: "showroom",
            resourceId: id,
            payload: {
                showroomName: showroom.name ?? null,
                reason: normalizedReason,
            },
            dedupeKey: `showroom:${id}:rejected`,
        };
    });

    try {
        // Guard: emit notification after commit to prevent tx-retry duplicate push sends.
        await createNotification(notificationDraft);
    } catch (err) {
        log.error(`Notification write skipped (reject ${id}): ${err?.message || err}`);
    }

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
        editCount: (showroom.editCount || 0) + 1,
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
