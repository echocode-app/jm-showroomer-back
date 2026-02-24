// Field selection for marker vs full card payloads.

import { normalizeShowroomForResponse } from "../../response.js";

export function applyFieldMode(showroom, mode) {
    const normalized = normalizeShowroomForResponse(showroom);
    if (mode !== "marker") return normalized;
    const rawCoords = showroom?.geo?.coords ?? null;
    return {
        id: normalized.id,
        name: normalized.name ?? null,
        type: normalized.type ?? null,
        category: normalized.category ?? null,
        // Marker mode remains map-compatible even after public DTO geo hardening.
        geo: rawCoords ? { coords: rawCoords } : null,
    };
}
