import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { appendHistory, makeHistoryEntry } from "./_helpers.js";
import { DEV_STORE, useDevMock } from "./_store.js";

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

        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    const snap = await ref.get();

    if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = snap.data();
    if (showroom.status !== "pending") {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }

    const statusBefore = showroom.status;
    const updatedAt = new Date().toISOString();

    const updates = {
        status: "rejected",
        reviewedAt: updatedAt,
        reviewedBy: { uid: user.uid, role: user.role },
        reviewReason: reason,
        pendingSnapshot: null,
        updatedAt,
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
                at: updatedAt,
            })
        ),
    };

    await ref.update(updates);
    return { id, ...showroom, ...updates };
}
