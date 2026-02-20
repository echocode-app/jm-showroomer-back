// Showroom derived-field policy.
// Responsibility: centralize all persisted derived-field calculations.
// Invariant: client input must never be trusted for derived fields.

import {
    buildBrandsMap,
    normalizeAddressForCompare,
    normalizeBrands,
    normalizeShowroomName,
} from "../../utils/showroomValidation.js";
import { buildGeo } from "../../utils/geoValidation.js";

// DERIVED FIELD (persisted for Firestore query/index performance)
export function deriveNameNormalized(name) {
    return normalizeShowroomName(name);
}

// DERIVED FIELD (used by duplicate detection on submit/review flows)
export function deriveAddressNormalized(address) {
    return address ? normalizeAddressForCompare(address) : null;
}

// DERIVED FIELD (persisted for Firestore query/index performance)
export function deriveBrandsFields(brands = []) {
    return {
        brandsNormalized: normalizeBrands(brands),
        brandsMap: buildBrandsMap(brands),
    };
}

// DERIVED FIELD (persisted for Firestore geo query/index performance)
export function deriveGeoFields(geo) {
    return geo ? buildGeo(geo) : null;
}
