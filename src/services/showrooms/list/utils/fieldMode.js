// Field selection for marker vs full card payloads.

import { normalizeShowroomForResponse } from "../../response.js";

export function applyFieldMode(showroom, mode) {
    const normalized = normalizeShowroomForResponse(showroom);
    if (mode !== "marker") return normalized;
    return {
        id: normalized.id,
        name: normalized.name ?? null,
        type: normalized.type ?? null,
        category: normalized.category ?? null,
        geo: normalized.geo?.coords ? { coords: normalized.geo.coords } : null,
    };
}
