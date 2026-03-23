import { getFirestoreInstance } from "../../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { log } from "../../config/logger.js";
import { badRequest } from "../../core/error.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { normalizeAddressForCompare, normalizeShowroomName } from "../../utils/showroomValidation.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { buildAnalyticsEvent } from "../analytics/analyticsEventBuilder.js";
import { record } from "../analytics/analyticsEventService.js";
import { ANALYTICS_EVENTS } from "../analytics/eventNames.js";
import {
    assertCountryAllowed,
    assertShowroomReady,
    assertSubmittableShowroom,
    buildSubmitUpdates,
    ensureNormalizedFields,
} from "./submit/helpers.js";
import { assertNoOwnerRecreateCooldown } from "./recreateCooldown.js";

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
        await emitShowroomSubmitForReviewAnalytics({ user, showroomId: id, ownerUid: showroom.ownerUid ?? user?.uid ?? null });

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

        assertNoOwnerDuplicateAtSameAddress(
            ownerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            id,
            normalized.nameNormalized,
            normalized.addressNormalized
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
        assertSubmittedAtInvariant(updates);

        const persistedUpdates = {
            ...updates,
            // Firestore commit time is the queue source-of-truth for moderation ordering.
            submittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        assertSubmittedAtInvariant(persistedUpdates);

        tx.update(ref, persistedUpdates);
        result = { id, ...showroom, ...updates };
    });

    await emitShowroomSubmitForReviewAnalytics({
        user,
        showroomId: id,
        ownerUid: result?.ownerUid ?? user?.uid ?? null,
    });

    return result;
}

function assertSubmittedAtInvariant(updates) {
    // Pending moderation queue depends on submittedAt ordering.
    // Fail closed if an internal refactor ever drops this field from submit updates.
    if (!updates || updates.submittedAt === undefined || updates.submittedAt === null) {
        const err = new Error("Pending submit requires submittedAt");
        err.code = "INTERNAL_ERROR";
        err.status = 500;
        throw err;
    }
}

async function emitShowroomSubmitForReviewAnalytics({ user, showroomId, ownerUid }) {
    try {
        await record(buildAnalyticsEvent({
            eventName: ANALYTICS_EVENTS.SHOWROOM_SUBMIT_FOR_REVIEW,
            source: "server",
            actor: {
                userId: user?.uid ?? null,
                isAnonymous: false,
            },
            context: {
                surface: "showroom_submit",
            },
            resource: {
                type: "showroom",
                id: showroomId,
                ownerUserId: ownerUid,
            },
            meta: {
                producer: "backend_api",
            },
        }));
    } catch (err) {
        log.error(`Analytics emit failed (showroom_submit_for_review ${showroomId}): ${err?.message || err}`);
    }
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
    assertNoOwnerRecreateCooldown(DEV_STORE.showrooms, {
        ownerUid: user.uid,
        showroomId: showroom.id,
        normalizedName: normalized.nameNormalized,
    });

    const ownerDuplicates = DEV_STORE.showrooms.filter(s => {
        if (s.id === showroom.id) return false;
        if (s.ownerUid !== user.uid) return false;
        if (s.status === "deleted") return false;

        const otherName = s.nameNormalized ?? normalizeShowroomName(s.name || "");
        const otherAddress =
            s.addressNormalized ?? normalizeAddressForCompare(s.address || "");

        return (
            otherName === normalized.nameNormalized &&
            otherAddress === normalized.addressNormalized
        );
    });
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
 * Rejects duplicate showroom identity inside one owner portfolio.
 */
function assertNoOwnerDuplicateAtSameAddress(items, showroomId, normalizedName, normalizedAddress) {
    const ownerUid = items.find(s => s.id === showroomId)?.ownerUid ?? null;
    assertNoOwnerRecreateCooldown(items, {
        ownerUid,
        showroomId,
        normalizedName,
    });

    const duplicates = items.filter(s => {
        if (s.id === showroomId) return false;
        if (s.status === "deleted") return false;

        const otherName = s.nameNormalized ?? normalizeShowroomName(s.name || "");
        const otherAddress =
            s.addressNormalized ?? normalizeAddressForCompare(s.address || "");

        return otherName === normalizedName && otherAddress === normalizedAddress;
    });
    if (duplicates.length > 0) {
        throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
    }
}
