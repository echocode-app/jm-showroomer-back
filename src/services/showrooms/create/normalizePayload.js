// Normalizes create payload into Firestore-ready fields.

import {
    buildBrandsMap,
    normalizeAddress,
    normalizeAddressForCompare,
    normalizeBrands,
    normalizeInstagramUrl,
    normalizeShowroomName,
    validateInstagramUrl,
    validatePhone,
    validateShowroomName,
} from "../../../utils/showroomValidation.js";
import { buildGeo } from "../../../utils/geoValidation.js";
import { applyCategoryPayload } from "../_categoryHelpers.js";

export function normalizeCreatePayload(data, options = {}) {
    // Step 1: validate and normalize name once; this key powers prefix search.
    validateShowroomName(data.name);
    const nameNormalized = normalizeShowroomName(data.name);

    // Step 2: canonicalize address and store comparison key for duplicate detection.
    const address = data.address ? normalizeAddress(data.address) : null;
    const addressNormalized = address ? normalizeAddressForCompare(address) : null;

    // Step 3: normalize geo payload and compute map/search derivatives (cityNormalized/geohash).
    const geo = data.geo ? buildGeo(data.geo) : null;
    const brandsNormalized = normalizeBrands(data.brands ?? []);
    const brandsMap = buildBrandsMap(data.brands ?? []);
    const { categoryGroup, subcategories } = applyCategoryPayload(data);

    const contacts = {
        phone: null,
        instagram: null,
    };

    // Contacts are normalized here so downstream flows can rely on stable stored format.
    if (data.contacts?.instagram) {
        const normalizedInstagram = normalizeInstagramUrl(data.contacts.instagram);
        validateInstagramUrl(normalizedInstagram);
        contacts.instagram = normalizedInstagram;
    } else if (data.contacts?.instagram === "") {
        contacts.instagram = null;
    }

    if (data.contacts?.phone) {
        // Phone is persisted in E.164 to keep validation/search deterministic.
        const { e164 } = validatePhone(
            data.contacts.phone,
            options.userCountry ?? data.country ?? null
        );
        contacts.phone = e164;
    } else if (data.contacts?.phone === "") {
        contacts.phone = null;
    }

    return {
        nameNormalized,
        address,
        addressNormalized,
        geo,
        brandsNormalized,
        brandsMap,
        categoryGroup: categoryGroup ?? null,
        subcategories: subcategories ?? [],
        contacts,
    };
}
