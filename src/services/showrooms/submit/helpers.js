// Submit helpers: access checks, normalization, and pending updates.

import { badRequest, forbidden, notFound } from "../../../core/error.js";
import { isCountryBlocked } from "../../../constants/countries.js";
import {
    assertShowroomComplete,
} from "../../../utils/showroomValidation.js";
import { appendHistory, buildPendingSnapshot, isSameCountry, makeHistoryEntry } from "../_helpers.js";
import { deriveAddressNormalized, deriveNameNormalized } from "../derivedFields.js";

export function assertSubmittableShowroom(showroom, user) {
    if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");
    if (showroom.ownerUid !== user.uid) throw forbidden("ACCESS_DENIED");
    if (showroom.status === "pending") {
        throw badRequest("SHOWROOM_LOCKED_PENDING");
    }
    if (showroom.status === "deleted") {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }
    if (!["draft", "rejected", "approved"].includes(showroom.status)) {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }
}

export function assertCountryAllowed(showroom, user) {
    if (isCountryBlocked(showroom.country)) {
        throw forbidden("COUNTRY_BLOCKED");
    }
    if (user?.country && !isSameCountry(showroom.country, user.country)) {
        throw forbidden("ACCESS_DENIED");
    }
}

export function ensureNormalizedFields(showroom) {
    // CANONICAL FIELD
    // `name` is source-of-truth.
    // DERIVED FIELD (persisted for search + duplicate guard)
    // `nameNormalized` is never accepted from client as authoritative input.
    const nameNormalized =
        showroom.nameNormalized ?? deriveNameNormalized(showroom.name);

    // CANONICAL FIELD
    // `address` is source-of-truth.
    // DERIVED FIELD (duplicate detection only)
    // `addressNormalized` exists to make duplicate checks stable across address formatting variants.
    const addressNormalized =
        showroom.addressNormalized ??
        deriveAddressNormalized(showroom.address);

    return { nameNormalized, addressNormalized };
}

export function buildSubmitUpdates(showroom, user, normalized, updatedAt) {
    return {
        status: "pending",
        submittedAt: updatedAt,
        updatedAt,
        // DERIVED FIELD (persisted for search + duplicate guard)
        nameNormalized: normalized.nameNormalized,
        // DERIVED FIELD (duplicate detection only)
        addressNormalized: normalized.addressNormalized,
        pendingSnapshot: buildPendingSnapshot(showroom, {
            nameNormalized: normalized.nameNormalized,
            addressNormalized: normalized.addressNormalized,
            ownerUid: showroom.ownerUid,
        }),
        editHistory: appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "submit",
                actor: user,
                statusBefore: showroom.status,
                statusAfter: "pending",
                changedFields: ["status"],
                diff: {
                    status: { from: showroom.status, to: "pending" },
                },
                at: updatedAt,
            })
        ),
    };
}

export function assertShowroomReady(showroom) {
    assertShowroomComplete(showroom);
}
