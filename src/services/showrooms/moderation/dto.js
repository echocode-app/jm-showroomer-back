import { toIsoString } from "../../../utils/timestamp.js";

// Admin moderation queue DTO is intentionally minimal:
// enough to review queue items, but no snapshots/history/derived search metadata.
export function mapModerationDTO(showroomDoc = {}) {
    return {
        id: showroomDoc.id ?? null,
        name: showroomDoc.name ?? null,
        type: showroomDoc.type ?? null,
        country: showroomDoc.country ?? null,
        city: showroomDoc.city ?? null,
        ownerUid: showroomDoc.ownerUid ?? null,
        submittedAt: toIsoString(showroomDoc.submittedAt),
        createdAt: toIsoString(showroomDoc.createdAt),
        updatedAt: toIsoString(showroomDoc.updatedAt),
        editCount: Number.isFinite(showroomDoc.editCount)
            ? showroomDoc.editCount
            : (showroomDoc.editCount ?? 0),
        status: showroomDoc.status ?? null,
    };
}

// Backward-compatible alias for existing imports.
export const mapShowroomToAdminModerationQueueDTO = mapModerationDTO;

