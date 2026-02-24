import { toIsoString } from "../../utils/timestamp.js";

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.map(entry => ({
        ...entry,
        at: toIsoString(entry?.at),
    }));
}

function pickPublicContacts(contacts) {
    if (!contacts || typeof contacts !== "object" || Array.isArray(contacts)) return null;
    const next = {};

    // Public contract hardening: keep only non-sensitive contact channels.
    if (typeof contacts.instagram === "string") next.instagram = contacts.instagram;
    if (typeof contacts.email === "string") next.email = contacts.email;
    if (typeof contacts.website === "string") next.website = contacts.website;

    return Object.keys(next).length > 0 ? next : null;
}

function pickPublicGeo(geo, { includeCoords = false } = {}) {
    if (!geo || typeof geo !== "object" || Array.isArray(geo)) return null;
    const next = {
        city: geo.city,
        cityNormalized: geo.cityNormalized,
        country: geo.country,
        geohash: geo.geohash,
    };
    if (includeCoords && geo.placeId) next.placeId = geo.placeId;
    if (includeCoords && geo.coords && typeof geo.coords === "object" && !Array.isArray(geo.coords)) {
        next.coords = geo.coords;
    }
    return next;
}

// Public DTO field policy:
// - canonical fields are returned as-is;
// - derived/compat fields remain exposed for backward compatibility;
// - whitelist-only (no unknown passthrough);
// - internal moderation/audit fields are hidden for public baseline.
export function mapShowroomToPublicDTO(showroomDoc, options = {}) {
    if (!showroomDoc || typeof showroomDoc !== "object") return showroomDoc;
    const includeInternal = options.includeInternal === true;
    const includeGeoCoords = options.includeGeoCoords === true;
    const includePhone = options.includePhone === true;

    const contacts = includePhone
        ? showroomDoc.contacts
        : pickPublicContacts(showroomDoc.contacts);

    const dto = {
        id: showroomDoc.id,
        name: showroomDoc.name,
        nameNormalized: showroomDoc.nameNormalized,
        type: showroomDoc.type,
        availability: showroomDoc.availability,
        category: showroomDoc.category,
        categoryGroup: showroomDoc.categoryGroup,
        subcategories: showroomDoc.subcategories,
        brands: showroomDoc.brands,
        brandsNormalized: showroomDoc.brandsNormalized,
        brandsMap: showroomDoc.brandsMap,
        address: showroomDoc.address,
        addressNormalized: showroomDoc.addressNormalized,
        country: showroomDoc.country,
        city: showroomDoc.city,
        geo: pickPublicGeo(showroomDoc.geo, { includeCoords: includeGeoCoords }),
        contacts,
        status: showroomDoc.status,
        editCount: showroomDoc.editCount,
        createdAt: showroomDoc.createdAt,
        updatedAt: showroomDoc.updatedAt,
        submittedAt: showroomDoc.submittedAt,
    };
    if (includeInternal) {
        dto.ownerUid = showroomDoc.ownerUid;
        dto.location = showroomDoc.location;
        dto.editHistory = showroomDoc.editHistory;
        dto.pendingSnapshot = showroomDoc.pendingSnapshot;
        dto.deletedAt = showroomDoc.deletedAt;
        dto.deletedBy = showroomDoc.deletedBy;
        dto.reviewedAt = showroomDoc.reviewedAt;
        dto.reviewedBy = showroomDoc.reviewedBy;
        dto.reviewReason = showroomDoc.reviewReason;
    }

    return dto;
}

export function normalizeShowroomForResponse(showroom, options = {}) {
    if (!showroom || typeof showroom !== "object") return showroom;
    const dto = mapShowroomToPublicDTO(showroom, options);
    const normalized = {
        ...dto,
        createdAt: toIsoString(dto.createdAt),
        updatedAt: toIsoString(dto.updatedAt),
        submittedAt: toIsoString(dto.submittedAt),
    };

    if ("reviewedAt" in dto) normalized.reviewedAt = toIsoString(dto.reviewedAt);
    if ("deletedAt" in dto) normalized.deletedAt = toIsoString(dto.deletedAt);
    if ("editHistory" in dto) normalized.editHistory = normalizeHistory(dto.editHistory);

    return normalized;
}
