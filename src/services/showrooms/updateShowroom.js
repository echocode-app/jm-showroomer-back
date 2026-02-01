import isEqual from "lodash.isequal";
import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, forbidden, notFound } from "../../core/error.js";
import { isCountryBlocked } from "../../constants/countries.js";
import {
    normalizeAddress,
    normalizeAddressForCompare,
    normalizeInstagramUrl,
    normalizeShowroomName,
    validateInstagramUrl,
    validatePhone,
    validateShowroomName,
} from "../../utils/showroomValidation.js";
import { EDITABLE_FIELDS } from "./_constants.js";
import { isSameCountry } from "./_helpers.js";
import { DEV_STORE, useDevMock } from "./_store.js";

export async function updateShowroomService(id, data, user) {
    if (data.country && isCountryBlocked(data.country)) {
        throw forbidden("COUNTRY_BLOCKED");
    }

    if (data.country && user?.country && !isSameCountry(data.country, user.country)) {
        throw forbidden("ACCESS_DENIED");
    }

    if (data.name !== undefined) {
        validateShowroomName(data.name);
        data.nameNormalized = normalizeShowroomName(data.name);
    } else if (data.nameNormalized !== undefined) {
        delete data.nameNormalized;
    }

    if (data.address !== undefined) {
        if (data.address) {
            data.address = normalizeAddress(data.address);
            data.addressNormalized = normalizeAddressForCompare(data.address);
        } else {
            data.address = null;
            data.addressNormalized = null;
        }
    } else if (data.addressNormalized !== undefined) {
        delete data.addressNormalized;
    }

    if (data.contacts !== undefined) {
        const contacts = { ...(data.contacts ?? {}) };
        if (contacts.instagram !== undefined) {
            if (contacts.instagram) {
                const normalizedInstagram = normalizeInstagramUrl(contacts.instagram);
                validateInstagramUrl(normalizedInstagram);
                contacts.instagram = normalizedInstagram;
            } else {
                contacts.instagram = null;
            }
        }

        if (contacts.phone !== undefined) {
            if (contacts.phone) {
                const { e164 } = validatePhone(contacts.phone, user?.country ?? null);
                contacts.phone = e164;
            } else {
                contacts.phone = null;
            }
        }

        data.contacts = contacts;
    }

    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");
        if (showroom.ownerUid !== user.uid) throw forbidden("ACCESS_DENIED");
        if (!['draft', 'rejected'].includes(showroom.status)) {
            throw badRequest("SHOWROOM_NOT_EDITABLE");
        }

        if (data.contacts !== undefined) {
            data.contacts = { ...(showroom.contacts || {}), ...data.contacts };
        }

        const changedFields = {};

        EDITABLE_FIELDS.forEach(field => {
            if (data[field] !== undefined && !isEqual(data[field], showroom[field])) {
                const fromValue = showroom[field];
                const toValue = data[field];
                changedFields[field] = {
                    from: fromValue === undefined ? null : fromValue,
                    to: toValue === undefined ? null : toValue,
                };
                showroom[field] = data[field];
            }
        });

        if (Object.keys(changedFields).length === 0) {
            throw badRequest("NO_FIELDS_TO_UPDATE");
        }

        showroom.editCount = (showroom.editCount || 0) + 1;
        showroom.updatedAt = new Date().toISOString();
        showroom.editHistory.push({
            editorUid: user.uid,
            editorRole: user.role,
            timestamp: showroom.updatedAt,
            changes: changedFields,
        });

        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    const snap = await ref.get();

    if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = snap.data();
    if (showroom.ownerUid !== user.uid) throw forbidden("ACCESS_DENIED");
    if (!['draft', 'rejected'].includes(showroom.status)) {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }

    if (data.contacts !== undefined) {
        data.contacts = { ...(showroom.contacts || {}), ...data.contacts };
    }

    const updates = {};
    const changedFields = {};

    for (const field of EDITABLE_FIELDS) {
        if (data[field] !== undefined && !isEqual(data[field], showroom[field])) {
            updates[field] = data[field];
            const fromValue = showroom[field];
            const toValue = data[field];
            changedFields[field] = {
                from: fromValue === undefined ? null : fromValue,
                to: toValue === undefined ? null : toValue,
            };
        }
    }

    if (Object.keys(updates).length === 0) {
        throw badRequest("NO_FIELDS_TO_UPDATE");
    }

    updates.editCount = (showroom.editCount || 0) + 1;
    updates.updatedAt = new Date().toISOString();
    updates.editHistory = [
        ...(showroom.editHistory || []),
        {
            editorUid: user.uid,
            editorRole: user.role,
            timestamp: updates.updatedAt,
            changes: changedFields,
        },
    ];

    await ref.update(updates);
    return { id, ...showroom, ...updates };
}
