import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, forbidden } from "../../core/error.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { buildDiff, isSameCountry } from "./_helpers.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { normalizePatchData } from "./update/normalizePatch.js";
import {
    applyCategoryPatch,
    assertEditableShowroom,
    buildHistoryUpdate,
    mergeContacts,
} from "./update/helpers.js";

/**
 * Updates editable showroom fields and appends one audit history entry.
 */
export async function updateShowroomService(id, data, user) {
    assertCountryPatchAllowed(data, user);

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        const { diff, changedFields, historyUpdate } = buildPatchPayload(showroom, data, user);

        // DEV mode writes directly into the in-memory object.
        changedFields.forEach(field => {
            showroom[field] = diff[field].to;
        });
        showroom.editCount = historyUpdate.editCount;
        showroom.updatedAt = historyUpdate.updatedAt;
        showroom.editHistory = historyUpdate.editHistory;

        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    const snap = await ref.get();

    const showroom = snap.exists ? snap.data() : null;
    const { diff, changedFields, historyUpdate } = buildPatchPayload(showroom, data, user);

    const updates = buildPersistedUpdates(diff, changedFields, historyUpdate);

    await ref.update(updates);
    return { id, ...showroom, ...updates };
}

/**
 * Guards country-level constraints before any write logic starts.
 */
function assertCountryPatchAllowed(data, user) {
    if (data.country && isCountryBlocked(data.country)) {
        throw forbidden("COUNTRY_BLOCKED");
    }

    if (data.country && user?.country && !isSameCountry(data.country, user.country)) {
        throw forbidden("ACCESS_DENIED");
    }
}

/**
 * Normalizes patch data, validates consistency, and computes changed fields.
 */
function buildPatchPayload(showroom, data, user) {
    assertEditableShowroom(showroom, user);
    // Canonical/derived policy is enforced in one place:
    // `normalizePatchData` recomputes all persisted derived fields from canonical inputs.
    normalizePatchData(data, user);

    // Geo country and top-level showroom country must stay aligned for map filtering correctness.
    const nextCountry = data.country ?? showroom?.country ?? null;
    const nextGeo = data.geo ?? showroom?.geo ?? null;
    if (nextGeo && nextCountry && !isSameCountry(nextGeo.country, nextCountry)) {
        throw badRequest("VALIDATION_ERROR");
    }

    mergeContacts(showroom, data);
    applyCategoryPatch(data, showroom);

    const proposed = { ...showroom, ...data };
    const { diff, changedFields } = buildDiff(showroom, proposed);
    if (changedFields.length === 0) {
        throw badRequest("NO_FIELDS_TO_UPDATE");
    }

    const updatedAt = new Date().toISOString();
    const historyUpdate = buildHistoryUpdate(showroom, changedFields, diff, user, updatedAt);
    return { diff, changedFields, historyUpdate };
}

/**
 * Transforms a diff payload into a Firestore `update` object.
 */
function buildPersistedUpdates(diff, changedFields, historyUpdate) {
    const updates = {};
    changedFields.forEach(field => {
        updates[field] = diff[field].to;
    });
    updates.editCount = historyUpdate.editCount;
    updates.updatedAt = historyUpdate.updatedAt;
    updates.editHistory = historyUpdate.editHistory;
    return updates;
}
