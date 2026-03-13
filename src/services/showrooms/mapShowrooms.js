import ngeohash from "ngeohash";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { buildBaseQuery } from "./list/firestore/baseQuery.js";
import { filterDevShowroomsBase } from "./list/devFilters.js";
import { applyVisibilityPostFilter } from "./list/utils/index.js";
import { isIndexNotReadyError, buildDomainError } from "./list/firestore/indexErrors.js";
import { normalizeShowroomForResponse } from "./response.js";
import { parseMapFilters } from "./map/parse.js";

const MAX_POINTS = 200;
const MAX_PREFIXES = 60;
const MAX_SCAN_DOCS = 600;

const GEOHASH_CELL_KM = {
    2: { lat: 625, lng: 1250 },
    3: { lat: 156, lng: 156 },
    4: { lat: 19.5, lng: 39.1 },
    5: { lat: 4.89, lng: 4.89 },
    6: { lat: 0.61, lng: 1.22 },
};

function precisionForZoom(zoom) {
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

function getCoords(showroom) {
    return showroom?.geo?.coords ?? showroom?.location ?? null;
}

function isWithinBounds(showroom, bounds) {
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

function resolveBoundedPrefixes(bounds, requestedPrecision) {
    let precision = requestedPrecision;
    let prefixes = buildBoundsPrefixes(bounds, precision);

    while (prefixes.length > MAX_PREFIXES && precision > 2) {
        precision -= 1;
        prefixes = buildBoundsPrefixes(bounds, precision);
    }

    return { precision, prefixes };
}

function mapShowroomToPoint(showroom, user) {
    const privileged = Boolean(user && (user.role === "admin" || user.uid === showroom.ownerUid));
    const dto = normalizeShowroomForResponse(showroom, {
        includeGeoCoords: true,
        includeInternal: privileged,
        includePhone: privileged,
    });

    return {
        id: dto.id,
        name: dto.name ?? null,
        type: dto.type ?? null,
        category: dto.category ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        country: dto.country ?? null,
        status: dto.status ?? null,
        geo: {
            coords: dto.geo?.coords ?? null,
        },
    };
}

function finalizeVisibleItems(items, bounds, user) {
    let filtered = items.filter(item => isWithinBounds(item, bounds));
    filtered = applyVisibilityPostFilter(filtered, user);
    filtered = filtered.filter(item => !isCountryBlocked(item.country));
    return filtered;
}

function fetchPointsDev(parsed, bounds, user) {
    const items = filterDevShowroomsBase(parsed, user, { includeGeohash: false, includeQName: false });
    const filtered = finalizeVisibleItems(items, bounds, user);
    const truncated = filtered.length > MAX_POINTS;

    return {
        showrooms: filtered
            .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")) || a.id.localeCompare(b.id))
            .slice(0, MAX_POINTS)
            .map(item => mapShowroomToPoint(item, user)),
        total: filtered.length,
        scanned: filtered.length,
        truncated,
    };
}

async function fetchPointsFirestore(baseQuery, prefixes, bounds, user) {
    const perPrefixLimit = Math.max(10, Math.ceil(MAX_SCAN_DOCS / Math.max(prefixes.length, 1)));
    const snapshots = await Promise.all(
        prefixes.map(prefix =>
            baseQuery
                .where("geo.geohash", ">=", prefix)
                .where("geo.geohash", "<=", `${prefix}\uf8ff`)
                .orderBy("geo.geohash", "asc")
                .limit(perPrefixLimit)
                .get()
        )
    );

    const byId = new Map();
    snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if (byId.size >= MAX_SCAN_DOCS) return;
            byId.set(doc.id, { id: doc.id, ...doc.data() });
        });
    });

    const filtered = finalizeVisibleItems(Array.from(byId.values()), bounds, user);
    filtered.sort((a, b) => {
        const aValue = String(a.updatedAt ?? "");
        const bValue = String(b.updatedAt ?? "");
        const cmp = bValue.localeCompare(aValue);
        if (cmp !== 0) return cmp;
        return a.id.localeCompare(b.id);
    });

    return {
        showrooms: filtered.slice(0, MAX_POINTS).map(item => mapShowroomToPoint(item, user)),
        total: filtered.length,
        scanned: byId.size,
        truncated: byId.size >= MAX_SCAN_DOCS || filtered.length > MAX_POINTS,
    };
}

export async function mapShowroomsService(filters, user = null) {
    const parsed = parseMapFilters(filters);
    const requestedPrecision = precisionForZoom(parsed.zoom);
    const { precision: queryPrecision, prefixes } = resolveBoundedPrefixes(parsed.bounds, requestedPrecision);

    if (useDevMock) {
        const result = fetchPointsDev(parsed, parsed.bounds, user);
        return {
            showrooms: result.showrooms,
            meta: {
                zoom: parsed.zoom,
                queryPrecision,
                prefixesCount: prefixes.length,
                total: result.total,
                scanned: result.scanned,
                truncated: result.truncated,
            },
        };
    }

    const db = getFirestoreInstance();
    const baseQuery = buildBaseQuery(db.collection("showrooms"), parsed, user);

    try {
        const result = await fetchPointsFirestore(baseQuery, prefixes, parsed.bounds, user);
        return {
            showrooms: result.showrooms,
            meta: {
                zoom: parsed.zoom,
                queryPrecision,
                prefixesCount: prefixes.length,
                total: result.total,
                scanned: result.scanned,
                truncated: result.truncated,
            },
        };
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY", { collection: "showrooms" }, err);
        }
        throw err;
    }
}
