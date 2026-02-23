import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest } from "../../core/error.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { normalizeAddressForCompare, normalizeShowroomName } from "../../utils/showroomValidation.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import {
    assertCountryAllowed,
    assertShowroomReady,
    assertSubmittableShowroom,
    buildSubmitUpdates,
    ensureNormalizedFields,
} from "./submit/helpers.js";

/**
 * Moves showroom from editable states into `pending` after duplicate checks.
 */
export async function submitShowroomForReviewService(id, user) {
    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        const normalized = validateAndNormalizeSubmittable(showroom, user);
        assertNoDevDuplicates(showroom, user, normalized);

        showroom.nameNormalized = normalized.nameNormalized;
        showroom.addressNormalized = normalized.addressNormalized;
        const updates = buildSubmitUpdates(
            showroom,
            user,
            normalized,
            new Date().toISOString()
        );
        showroom.status = updates.status;
        showroom.submittedAt = updates.submittedAt;
        showroom.updatedAt = updates.updatedAt;
        showroom.pendingSnapshot = updates.pendingSnapshot;
        showroom.editHistory = updates.editHistory;

        return showroom;
    }

    // Transaction boundary:
    // duplicate checks + pending transition execute in one tx to keep deleteLock/user writability
    // invariant and submit state transition atomic.
    // No push inside tx:
    // submit flow does not emit push/notification writes.
    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    let result = null;

    await db.runTransaction(async tx => {
        if (user?.uid) {
            await assertUserWritableInTx(tx, user.uid);
        }
        const snap = await tx.get(ref);
        const showroom = snap.exists ? snap.data() : null;
        const normalized = validateAndNormalizeSubmittable(showroom, user);

        const ownerSnapshot = await tx.get(
            db.collection("showrooms").where("ownerUid", "==", user.uid)
        );

        assertNoOwnerNameDuplicates(
            ownerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            id,
            normalized.nameNormalized
        );

        const duplicateSnapshot = await tx.get(
            db
                .collection("showrooms")
                .where("nameNormalized", "==", normalized.nameNormalized)
                // Derived-field invariant:
                // `addressNormalized` is used only for duplicate detection.
                .where("addressNormalized", "==", normalized.addressNormalized)
        );

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

        const updatedAt = new Date().toISOString();
        // Snapshot invariant:
        // once pendingSnapshot is built on submit, moderation must treat it as immutable source.
        const updates = buildSubmitUpdates(showroom, user, normalized, updatedAt);
        tx.update(ref, updates);
        result = { id, ...showroom, ...updates };
    });

    return result;
}

/**
 * Validates submit preconditions and computes normalized identity fields.
 */
function validateAndNormalizeSubmittable(showroom, user) {
    assertSubmittableShowroom(showroom, user);
    assertCountryAllowed(showroom, user);
    assertShowroomReady(showroom);
    return ensureNormalizedFields(showroom);
}

/**
 * Rejects owner-local duplicates for DEV mode.
 */
function assertNoDevDuplicates(showroom, user, normalized) {
    const ownerDuplicates = DEV_STORE.showrooms.filter(
        s =>
            s.id !== showroom.id &&
            s.ownerUid === user.uid &&
            s.status !== "deleted" &&
            (s.nameNormalized ?? normalizeShowroomName(s.name || "")) ===
                normalized.nameNormalized
    );
    if (ownerDuplicates.length > 0) {
        throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
    }

    const globalDuplicates = DEV_STORE.showrooms.filter(s => {
        if (s.id === showroom.id) return false;
        if (!["pending", "approved"].includes(s.status)) return false;
        const otherName = s.nameNormalized ?? normalizeShowroomName(s.name || "");
        const otherAddress =
            s.addressNormalized ?? normalizeAddressForCompare(s.address || "");
        return (
            otherName === normalized.nameNormalized &&
            otherAddress === normalized.addressNormalized
        );
    });

    if (globalDuplicates.length > 0) {
        throw badRequest("SHOWROOM_DUPLICATE");
    }
}

/**
 * Rejects duplicate showroom names inside one owner portfolio.
 */
function assertNoOwnerNameDuplicates(items, showroomId, normalizedName) {
    const duplicates = items.filter(
        s =>
            s.id !== showroomId &&
            s.status !== "deleted" &&
            (s.nameNormalized ?? normalizeShowroomName(s.name || "")) === normalizedName
    );
    if (duplicates.length > 0) {
        throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
    }
}
