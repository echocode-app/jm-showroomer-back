// Update helpers: access checks, merges, and history updates.

import { badRequest, forbidden, notFound } from "../../../core/error.js";
import { appendHistory, makeHistoryEntry } from "../_helpers.js";
import { applyCategoryPayload } from "../_categoryHelpers.js";

export function assertEditableShowroom(showroom, user) {
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

/**
 * Preserves existing contact fields when PATCH sends only a subset.
 */
export function mergeContacts(showroom, data) {
    if (data.contacts !== undefined) {
        data.contacts = { ...(showroom.contacts || {}), ...data.contacts };
    }
}

/**
 * Applies categoryGroup/subcategories normalization rules in one place.
 */
export function applyCategoryPatch(data, showroom) {
    if (data.categoryGroup !== undefined || data.subcategories !== undefined) {
        const normalized = applyCategoryPayload(data, showroom);
        if (normalized.categoryGroup !== undefined) {
            data.categoryGroup = normalized.categoryGroup;
        }
        if (normalized.subcategories !== undefined) {
            data.subcategories = normalized.subcategories;
        }
    }
}

/**
 * Produces standard edit history metadata for showroom patch operations.
 */
export function buildHistoryUpdate(showroom, changedFields, diff, user, updatedAt) {
    return {
        editCount: (showroom.editCount || 0) + 1,
        updatedAt,
        editHistory: appendHistory(
            showroom.editHistory || [],
            makeHistoryEntry({
                action: "patch",
                actor: user,
                statusBefore: showroom.status,
                statusAfter: showroom.status,
                changedFields,
                diff,
                at: updatedAt,
            })
        ),
    };
}
