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

// updateShowroomService
export async function updateShowroomService(id, data, user) {
    if (data.country && isCountryBlocked(data.country)) {
        throw forbidden("COUNTRY_BLOCKED");
    }

    if (data.country && user?.country && !isSameCountry(data.country, user.country)) {
        throw forbidden("ACCESS_DENIED");
    }

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        assertEditableShowroom(showroom, user);

        normalizePatchData(data, user);

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

        changedFields.forEach(field => {
            showroom[field] = diff[field].to;
        });

        const updatedAt = new Date().toISOString();
        const historyUpdate = buildHistoryUpdate(
            showroom,
            changedFields,
            diff,
            user,
            updatedAt
        );
        showroom.editCount = historyUpdate.editCount;
        showroom.updatedAt = historyUpdate.updatedAt;
        showroom.editHistory = historyUpdate.editHistory;

        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    const snap = await ref.get();

    const showroom = snap.exists ? snap.data() : null;
    assertEditableShowroom(showroom, user);

    normalizePatchData(data, user);

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

    const updates = {};
    changedFields.forEach(field => {
        updates[field] = diff[field].to;
    });

    const updatedAt = new Date().toISOString();
    const historyUpdate = buildHistoryUpdate(
        showroom,
        changedFields,
        diff,
        user,
        updatedAt
    );
    updates.editCount = historyUpdate.editCount;
    updates.updatedAt = historyUpdate.updatedAt;
    updates.editHistory = historyUpdate.editHistory;

    await ref.update(updates);
    return { id, ...showroom, ...updates };
}
