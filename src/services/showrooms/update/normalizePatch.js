// Normalizes patch payload fields (name/address/brands/contacts/geo).

import {
    normalizeAddress,
    normalizeInstagramUrl,
    validateInstagramUrl,
    validatePhone,
    validateShowroomName,
} from "../../../utils/showroomValidation.js";
import {
    deriveAddressNormalized,
    deriveBrandsFields,
    deriveGeoFields,
    deriveNameNormalized,
} from "../derivedFields.js";

export function normalizePatchData(data, user) {
    // CANONICAL FIELD
    // `name` is source-of-truth and may be updated by client.
    // DERIVED FIELD (persisted for Firestore query/index performance)
    // `nameNormalized` is recomputed server-side from canonical name.
    if (data.name !== undefined) {
        validateShowroomName(data.name);
        data.nameNormalized = deriveNameNormalized(data.name);
    } else if (data.nameNormalized !== undefined) {
        // Guard: derived fields cannot be client-controlled.
        delete data.nameNormalized;
    }

    // CANONICAL FIELD
    // `address` is source-of-truth.
    // DERIVED FIELD (duplicate detection only)
    // `addressNormalized` is recomputed from canonical address.
    if (data.address !== undefined) {
        if (data.address) {
            data.address = normalizeAddress(data.address);
            data.addressNormalized = deriveAddressNormalized(data.address);
        } else {
            data.address = null;
            data.addressNormalized = null;
        }
    } else if (data.addressNormalized !== undefined) {
        // Guard: derived fields cannot be client-controlled.
        delete data.addressNormalized;
    }

    // CANONICAL FIELD
    // `brands` is source-of-truth.
    // DERIVED FIELD (persisted for Firestore query/index performance)
    // `brandsNormalized` + `brandsMap` are recomputed from canonical brands.
    if (data.brands !== undefined) {
        const derived = deriveBrandsFields(data.brands);
        data.brandsNormalized = derived.brandsNormalized;
        data.brandsMap = derived.brandsMap;
    } else if (data.brandsNormalized !== undefined) {
        // Guard: derived fields cannot be client-controlled.
        delete data.brandsNormalized;
        delete data.brandsMap;
    }

    // Step 4: normalize mutable contact fields into persisted canonical format.
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

    // CANONICAL FIELD
    // `geo.city` + `geo.coords` are source-of-truth for geo flows.
    // DERIVED FIELD (persisted for Firestore query/index performance)
    // `geo.cityNormalized` + `geo.geohash` are recomputed from canonical geo payload.
    if (data.geo !== undefined) {
        data.geo = deriveGeoFields(data.geo);
    }
}
