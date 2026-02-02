import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { appendHistory, makeHistoryEntry } from "./_helpers.js";

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

        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    const snap = await ref.get();

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

    await ref.update(updates);
    return { id, ...showroom, ...updates };
}
