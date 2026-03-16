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

function buildBoundsPrefixes(bounds, precision) {
    const cell = GEOHASH_CELL_KM[precision] ?? GEOHASH_CELL_KM[2];
    const midLat = (bounds.north + bounds.south) / 2;
    const latStep = Math.max(kmToLatDegrees(cell.lat), 0.05);
    const lngStep = Math.max(kmToLngDegrees(cell.lng, midLat), 0.05);

    const prefixes = new Set();
    for (let lat = bounds.south; lat <= bounds.north + latStep / 2; lat += latStep) {
        for (let lng = bounds.west; lng <= bounds.east + lngStep / 2; lng += lngStep) {
            prefixes.add(ngeohash.encode(lat, lng, precision).toLowerCase());
        }
    }

    prefixes.add(ngeohash.encode(bounds.north, bounds.west, precision).toLowerCase());
    prefixes.add(ngeohash.encode(bounds.north, bounds.east, precision).toLowerCase());
    prefixes.add(ngeohash.encode(bounds.south, bounds.west, precision).toLowerCase());
    prefixes.add(ngeohash.encode(bounds.south, bounds.east, precision).toLowerCase());

    return Array.from(prefixes).sort();
}

export function resolveBoundedPrefixes(bounds, requestedPrecision) {
    let precision = requestedPrecision;
    let prefixes = buildBoundsPrefixes(bounds, precision);

    while (prefixes.length > MAX_PREFIXES && precision > 2) {
        precision -= 1;
        prefixes = buildBoundsPrefixes(bounds, precision);
    }

    return { precision, prefixes };
}

export function finalizeVisibleItems(items, bounds, user) {
    let filtered = items.filter(item => isWithinBounds(item, bounds));
    filtered = applyVisibilityPostFilter(filtered, user);
    filtered = filtered.filter(item => !isCountryBlocked(item.country));
    return filtered;
}
