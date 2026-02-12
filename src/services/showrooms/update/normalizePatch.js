// Normalizes patch payload fields (name/address/brands/contacts/geo).

import {
    normalizeAddress,
    normalizeAddressForCompare,
    normalizeInstagramUrl,
    buildBrandsMap,
    normalizeBrands,
    normalizeShowroomName,
    validateInstagramUrl,
    validatePhone,
    validateShowroomName,
} from "../../../utils/showroomValidation.js";
import { buildGeo } from "../../../utils/geoValidation.js";

export function normalizePatchData(data, user) {
    // Step 1: keep normalized name in sync whenever name is patched.
    if (data.name !== undefined) {
        validateShowroomName(data.name);
        data.nameNormalized = normalizeShowroomName(data.name);
    } else if (data.nameNormalized !== undefined) {
        delete data.nameNormalized;
    }

    // Step 2: keep `address` and `addressNormalized` pair consistent for duplicate checks.
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

    // Step 3: rebuild brand derivatives used by filter queries.
    if (data.brands !== undefined) {
        data.brandsNormalized = normalizeBrands(data.brands);
        data.brandsMap = buildBrandsMap(data.brands);
    } else if (data.brandsNormalized !== undefined) {
        delete data.brandsNormalized;
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

    // Step 5: rebuild geo derived fields from raw map payload.
    if (data.geo !== undefined) {
        if (data.geo) {
            data.geo = buildGeo(data.geo);
        } else {
            data.geo = null;
        }
    }
}
