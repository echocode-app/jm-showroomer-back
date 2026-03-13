// Field selection for geo/marker/full card payloads.

import { normalizeShowroomForResponse } from "../../response.js";

export function applyFieldMode(showroom, mode) {
    const normalized = normalizeShowroomForResponse(showroom);
    const rawCoords = showroom?.geo?.coords ?? null;
    if (mode === "geo") {
        return {
            id: normalized.id,
            geo: rawCoords ? { coords: rawCoords } : null,
        };
    }
    if (mode !== "marker") return normalized;
    return {
        id: normalized.id,
        name: normalized.name ?? null,
        type: normalized.type ?? null,
        category: normalized.category ?? null,
        address: normalized.address ?? null,
        city: normalized.city ?? null,
        country: normalized.country ?? null,
        // Marker mode remains map-compatible even after public DTO geo hardening.
        geo: rawCoords ? { coords: rawCoords } : null,
    };
}
