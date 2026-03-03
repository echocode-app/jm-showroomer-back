import { getFirestoreInstance } from "../../config/firebase.js";
import { log } from "../../config/logger.js";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { createNotification } from "../notifications/notificationService.js";
import { NOTIFICATION_TYPES } from "../notifications/types.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { appendHistory, makeHistoryEntry } from "./_helpers.js";

// assertCanDelete
function assertCanDelete(showroom, user, isAdmin) {
    if (!isAdmin && showroom.ownerUid !== user.uid) {
        throw forbidden("ACCESS_DENIED");
    }

    if (!isAdmin && showroom.status === "pending") {
        throw badRequest("SHOWROOM_LOCKED_PENDING");
    }

    if (!isAdmin && showroom.status === "deleted") {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }
}

// deleteShowroomService
export async function deleteShowroomService(id, user) {
    const isAdmin = user?.role === "admin";

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");

        assertCanDelete(showroom, user, isAdmin);

        const statusBefore = showroom.status;
        showroom.status = "deleted";
        showroom.deletedAt = new Date().toISOString();
        showroom.deletedBy = { uid: user.uid, role: user.role };
        showroom.updatedAt = showroom.deletedAt;
        showroom.editHistory = appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "delete",
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
        if (isAdmin) {
            try {
                await createNotification({
                    targetUid: showroom.ownerUid ?? null,
                    actorUid: user.uid,
                    type: NOTIFICATION_TYPES.SHOWROOM_DELETED_BY_ADMIN,
                    resourceType: "showroom",
                    resourceId: id,
                    payload: {
                        showroomName: showroom.name ?? null,
                        deletedAt: showroom.deletedAt,
                    },
                    dedupeKey: `showroom:${id}:deleted_by_admin`,
                });
            } catch (err) {
                log.error(`Notification write skipped (admin delete ${id}): ${err?.message || err}`);
            }
        }

        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    let result = null;
    let notificationDraft = null;
    await db.runTransaction(async tx => {
        if (user?.uid) {
            await assertUserWritableInTx(tx, user.uid);
        }
        const snap = await tx.get(ref);
        if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

        const showroom = snap.data();
        assertCanDelete(showroom, user, isAdmin);

        const statusBefore = showroom.status;
        const updatedAt = new Date().toISOString();

        const updates = {
            status: "deleted",
            deletedAt: updatedAt,
            deletedBy: { uid: user.uid, role: user.role },
            updatedAt,
            editHistory: appendHistory(
                showroom.editHistory || [],
                makeHistoryEntry({
                    action: "delete",
                    actor: user,
                    statusBefore,
                    statusAfter: "deleted",
                    changedFields: ["status"],
                    diff: {
                        status: { from: statusBefore, to: "deleted" },
                    },
                    at: updatedAt,
                })
            ),
        };

        tx.update(ref, updates);
        result = { id, ...showroom, ...updates };
        if (isAdmin) {
            notificationDraft = {
                targetUid: showroom.ownerUid ?? null,
                actorUid: user.uid,
                type: NOTIFICATION_TYPES.SHOWROOM_DELETED_BY_ADMIN,
                resourceType: "showroom",
                resourceId: id,
                payload: {
                    showroomName: showroom.name ?? null,
                    deletedAt: updatedAt,
                },
                dedupeKey: `showroom:${id}:deleted_by_admin`,
            };
        }
    });
    if (notificationDraft) {
        try {
            await createNotification(notificationDraft);
        } catch (err) {
            log.error(`Notification write skipped (admin delete ${id}): ${err?.message || err}`);
        }
    }
    return result;
}
