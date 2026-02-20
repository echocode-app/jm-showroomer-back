import { toIsoString } from "../../utils/timestamp.js";

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.map(entry => ({
        ...entry,
        at: toIsoString(entry?.at),
    }));
}

// Public DTO field policy:
// - canonical fields are returned as-is;
// - derived/compat fields remain exposed for backward compatibility;
// - unknown legacy fields are passed through to avoid contract breaks.
export function mapShowroomToPublicDTO(showroomDoc) {
    if (!showroomDoc || typeof showroomDoc !== "object") return showroomDoc;

    const dto = {
        id: showroomDoc.id,
        ownerUid: showroomDoc.ownerUid,
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
        geo: showroomDoc.geo,
        contacts: showroomDoc.contacts,
        location: showroomDoc.location,
        status: showroomDoc.status,
        editCount: showroomDoc.editCount,
        editHistory: showroomDoc.editHistory,
        pendingSnapshot: showroomDoc.pendingSnapshot,
        deletedAt: showroomDoc.deletedAt,
        deletedBy: showroomDoc.deletedBy,
        reviewedAt: showroomDoc.reviewedAt,
        reviewedBy: showroomDoc.reviewedBy,
        reviewReason: showroomDoc.reviewReason,
        createdAt: showroomDoc.createdAt,
        updatedAt: showroomDoc.updatedAt,
        submittedAt: showroomDoc.submittedAt,
    };

    for (const [key, value] of Object.entries(showroomDoc)) {
        if (!(key in dto)) dto[key] = value;
    }

    return dto;
}

export function normalizeShowroomForResponse(showroom) {
    if (!showroom || typeof showroom !== "object") return showroom;
    const dto = mapShowroomToPublicDTO(showroom);
    return {
        ...dto,
        createdAt: toIsoString(dto.createdAt),
        updatedAt: toIsoString(dto.updatedAt),
        reviewedAt: toIsoString(dto.reviewedAt),
        submittedAt: toIsoString(dto.submittedAt),
        deletedAt: toIsoString(dto.deletedAt),
        editHistory: normalizeHistory(dto.editHistory),
    };
}
