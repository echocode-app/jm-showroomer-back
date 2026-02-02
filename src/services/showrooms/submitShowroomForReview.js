import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { isCountryBlocked } from "../../constants/countries.js";
import {
    assertShowroomComplete,
    normalizeAddressForCompare,
    normalizeShowroomName,
} from "../../utils/showroomValidation.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { appendHistory, buildPendingSnapshot, isSameCountry, makeHistoryEntry } from "./_helpers.js";

export async function submitShowroomForReviewService(id, user) {
    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");
        if (showroom.ownerUid !== user.uid) throw forbidden("ACCESS_DENIED");
        if (showroom.status === "pending") {
            throw badRequest("SHOWROOM_LOCKED_PENDING");
        }
        if (showroom.status === "deleted") {
            throw badRequest("SHOWROOM_NOT_EDITABLE");
        }
        if (!['draft', 'rejected', 'approved'].includes(showroom.status)) {
            throw badRequest("SHOWROOM_NOT_EDITABLE");
        }

        if (isCountryBlocked(showroom.country)) {
            throw forbidden("COUNTRY_BLOCKED");
        }

        if (user?.country && !isSameCountry(showroom.country, user.country)) {
            throw forbidden("ACCESS_DENIED");
        }

        assertShowroomComplete(showroom);

        const nameNormalized =
            showroom.nameNormalized ?? normalizeShowroomName(showroom.name);
        const addressNormalized =
            showroom.addressNormalized ??
            normalizeAddressForCompare(showroom.address);

        const ownerDuplicates = DEV_STORE.showrooms.filter(
            s =>
                s.id !== showroom.id &&
                s.ownerUid === user.uid &&
                s.status !== "deleted" &&
                (s.nameNormalized ?? normalizeShowroomName(s.name || "")) ===
                    nameNormalized
        );

        if (ownerDuplicates.length > 0) {
            throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
        }

        const globalDuplicates = DEV_STORE.showrooms.filter(s => {
            if (s.id === showroom.id) return false;
            if (!["pending", "approved"].includes(s.status)) return false;
            const otherName =
                s.nameNormalized ?? normalizeShowroomName(s.name || "");
            const otherAddress =
                s.addressNormalized ??
                normalizeAddressForCompare(s.address || "");
            return (
                otherName === nameNormalized &&
                otherAddress === addressNormalized
            );
        });

        if (globalDuplicates.length > 0) {
            throw badRequest("SHOWROOM_DUPLICATE");
        }

        showroom.nameNormalized = nameNormalized;
        showroom.addressNormalized = addressNormalized;
        showroom.pendingSnapshot = buildPendingSnapshot(showroom, {
            nameNormalized,
            addressNormalized,
            ownerUid: showroom.ownerUid,
        });
        const statusBefore = showroom.status;
        showroom.status = "pending";
        showroom.submittedAt = new Date().toISOString();
        showroom.updatedAt = showroom.submittedAt;
        showroom.editHistory = appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "submit",
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
    if (showroom.ownerUid !== user.uid) throw forbidden("ACCESS_DENIED");
    if (showroom.status === "pending") {
        throw badRequest("SHOWROOM_LOCKED_PENDING");
    }
    if (showroom.status === "deleted") {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }
    if (!['draft', 'rejected', 'approved'].includes(showroom.status)) {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }

    if (isCountryBlocked(showroom.country)) {
        throw forbidden("COUNTRY_BLOCKED");
    }

    if (user?.country && !isSameCountry(showroom.country, user.country)) {
        throw forbidden("ACCESS_DENIED");
    }

    assertShowroomComplete(showroom);

    const nameNormalized =
        showroom.nameNormalized ?? normalizeShowroomName(showroom.name);
    const addressNormalized =
        showroom.addressNormalized ?? normalizeAddressForCompare(showroom.address);

    const ownerSnapshot = await db
        .collection("showrooms")
        .where("ownerUid", "==", user.uid)
        .get();

    const ownerDuplicates = ownerSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(
            s =>
                s.id !== id &&
                s.status !== "deleted" &&
                (s.nameNormalized ?? normalizeShowroomName(s.name || "")) ===
                    nameNormalized
        );

    if (ownerDuplicates.length > 0) {
        throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
    }

    const duplicateSnapshot = await db
        .collection("showrooms")
        .where("nameNormalized", "==", nameNormalized)
        .where("addressNormalized", "==", addressNormalized)
        .get();

    const globalDuplicates = duplicateSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(
            s =>
                s.id !== id &&
                ["pending", "approved"].includes(s.status)
        );

    if (globalDuplicates.length > 0) {
        throw badRequest("SHOWROOM_DUPLICATE");
    }

    const statusBefore = showroom.status;
    const updatedAt = new Date().toISOString();
    const updates = {
        status: "pending",
        submittedAt: updatedAt,
        updatedAt,
        nameNormalized,
        addressNormalized,
        pendingSnapshot: buildPendingSnapshot(showroom, {
            nameNormalized,
            addressNormalized,
            ownerUid: showroom.ownerUid,
        }),
        editHistory: appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "submit",
                actor: user,
                statusBefore,
                statusAfter: "pending",
                changedFields: ["status"],
                diff: {
                    status: { from: statusBefore, to: "pending" },
                },
                at: updatedAt,
            })
        ),
    };

    await ref.update(updates);
    return { id, ...showroom, ...updates };
}
