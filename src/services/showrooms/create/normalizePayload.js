// Normalizes create payload into Firestore-ready fields.

import {
    normalizeAddress,
    normalizeInstagramUrl,
    validateInstagramUrl,
    validatePhone,
    validateShowroomName,
} from "../../../utils/showroomValidation.js";
import { applyCategoryPayload } from "../_categoryHelpers.js";
import {
    deriveAddressNormalized,
    deriveBrandsFields,
    deriveGeoFields,
    deriveNameNormalized,
} from "../derivedFields.js";

export function normalizeCreatePayload(data, options = {}) {
    // CANONICAL FIELD
    // `name` is source-of-truth. `nameNormalized` is always recomputed from it.
    // DERIVED FIELD (persisted for Firestore query/index performance)
    // `nameNormalized` powers prefix search and stable duplicate checks.
    validateShowroomName(data.name);
    const nameNormalized = deriveNameNormalized(data.name);

    // CANONICAL FIELD
    // `address` is source-of-truth.
    // DERIVED FIELD (duplicate detection only)
    // `addressNormalized` is persisted to stabilize duplicate checks across formatting variants.
    const address = data.address ? normalizeAddress(data.address) : null;
    const addressNormalized = deriveAddressNormalized(address);

    // CANONICAL FIELD
    // `geo.city` + `geo.coords` are source-of-truth for city/location in geo-aware flows.
    // DERIVED FIELD (persisted for Firestore query/index performance)
    // `geo.cityNormalized` + `geo.geohash` are recomputed server-side from canonical geo input.
    const geo = deriveGeoFields(data.geo);

    // CANONICAL FIELD
    // `brands` is the source-of-truth list.
    // DERIVED FIELD (persisted for Firestore query/index performance)
    // `brandsNormalized` + `brandsMap` are recomputed from canonical `brands`.
    const { brandsNormalized, brandsMap } = deriveBrandsFields(data.brands ?? []);
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
