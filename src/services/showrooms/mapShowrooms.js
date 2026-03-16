import { getFirestoreInstance } from "../../config/firebase.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { buildBaseQuery } from "./list/firestore/baseQuery.js";
import { filterDevShowroomsBase } from "./list/devFilters.js";
import { isIndexNotReadyError, buildDomainError } from "./list/firestore/indexErrors.js";
import { normalizeShowroomForResponse } from "./response.js";
import { parseMapFilters } from "./map/parse.js";
import {
    finalizeVisibleItems,
    precisionForZoom,
    resolveBoundedPrefixes,
} from "./map/shared.js";

const MAX_POINTS = 200;
const MAX_SCAN_DOCS = 600;

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
