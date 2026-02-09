// Field selection for marker vs full card payloads.

export function applyFieldMode(showroom, mode) {
    if (mode !== "marker") return showroom;
    return {
        id: showroom.id,
        name: showroom.name ?? null,
        type: showroom.type ?? null,
        category: showroom.category ?? null,
        geo: showroom.geo?.coords ? { coords: showroom.geo.coords } : null,
    };
}
