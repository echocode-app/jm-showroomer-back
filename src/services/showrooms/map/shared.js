import ngeohash from "ngeohash";
import { isCountryBlocked } from "../../../constants/countries.js";
import { applyVisibilityPostFilter } from "../list/utils/index.js";

const MAX_PREFIXES = 60;

const GEOHASH_CELL_KM = {
    2: { lat: 625, lng: 1250 },
    3: { lat: 156, lng: 156 },
    4: { lat: 19.5, lng: 39.1 },
    5: { lat: 4.89, lng: 4.89 },
    6: { lat: 0.61, lng: 1.22 },
};

export function precisionForZoom(zoom) {
    if (zoom <= 4) return 2;
    if (zoom <= 6) return 3;
    if (zoom <= 8) return 4;
    if (zoom <= 10) return 5;
    return 6;
}

function kmToLatDegrees(km) {
    return km / 110.574;
}

function kmToLngDegrees(km, lat) {
    const cosine = Math.cos((lat * Math.PI) / 180);
    const safe = Math.max(Math.abs(cosine), 0.1);
    return km / (111.320 * safe);
}

export function getCoords(showroom) {
    return showroom?.geo?.coords ?? showroom?.location ?? null;
}

export function isWithinBounds(showroom, bounds) {
    const coords = getCoords(showroom);
    if (!coords) return false;
    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return (
        lat <= bounds.north &&
        lat >= bounds.south &&
        lng <= bounds.east &&
        lng >= bounds.west
    );
}

function intersectsBounds(cellBounds, bounds) {
    return !(
        cellBounds.north < bounds.south ||
        cellBounds.south > bounds.north ||
        cellBounds.east < bounds.west ||
        cellBounds.west > bounds.east
    );
}

function decodeBounds(hash) {
    const [south, west, north, east] = ngeohash.decode_bbox(hash);
    return { south, west, north, east };
}

function buildSeedHashes(bounds, precision) {
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    return Array.from(
        new Set([
            ngeohash.encode(bounds.north, bounds.west, precision).toLowerCase(),
            ngeohash.encode(bounds.north, bounds.east, precision).toLowerCase(),
            ngeohash.encode(bounds.south, bounds.west, precision).toLowerCase(),
            ngeohash.encode(bounds.south, bounds.east, precision).toLowerCase(),
            ngeohash.encode(centerLat, centerLng, precision).toLowerCase(),
        ])
    );
}

function buildBoundsPrefixes(bounds, precision, limit = Infinity) {
    const queue = buildSeedHashes(bounds, precision);
    const seen = new Set();
    const prefixes = new Set();

    while (queue.length > 0) {
        const hash = String(queue.shift() || "").toLowerCase();
        if (!hash || seen.has(hash)) continue;
        seen.add(hash);

        if (!intersectsBounds(decodeBounds(hash), bounds)) {
            continue;
        }

        prefixes.add(hash);
        if (prefixes.size > limit) {
            return Array.from(prefixes).sort();
        }

        const neighbors = ngeohash.neighbors(hash) || [];
        for (const neighbor of neighbors) {
            const next = String(neighbor || "").toLowerCase();
            if (next && !seen.has(next)) {
                queue.push(next);
            }
        }
    }

    return Array.from(prefixes).sort();
}

export function resolveBoundedPrefixes(bounds, requestedPrecision) {
    let precision = requestedPrecision;
    let prefixes = buildBoundsPrefixes(bounds, precision, MAX_PREFIXES);

    while (prefixes.length > MAX_PREFIXES && precision > 2) {
        precision -= 1;
        prefixes = buildBoundsPrefixes(bounds, precision, MAX_PREFIXES);
    }

    return { precision, prefixes };
}

export function finalizeVisibleItems(items, bounds, user) {
    let filtered = items.filter(item => isWithinBounds(item, bounds));
    filtered = applyVisibilityPostFilter(filtered, user);
    filtered = filtered.filter(item => !isCountryBlocked(item.country));
    return filtered;
}
