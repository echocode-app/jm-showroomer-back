import { getFirestoreInstance } from "../../config/firebase.js";
import { useDevMock } from "./_store.js";
import { buildBaseQuery } from "./list/firestore/baseQuery.js";
import { filterDevShowroomsBase } from "./list/devFilters.js";
import { isIndexNotReadyError, buildDomainError } from "./list/firestore/indexErrors.js";
import { parseMapFilters } from "./map/parse.js";
import {
    finalizeVisibleItems,
    precisionForZoom,
    resolveBoundedPrefixes,
} from "./map/shared.js";

const PAGE_SIZE = 500;

async function countPrefixExact(baseQuery, prefix, bounds, user) {
    let query = baseQuery
        .where("geo.geohash", ">=", prefix)
        .where("geo.geohash", "<=", `${prefix}\uf8ff`)
        .orderBy("geo.geohash", "asc")
        .limit(PAGE_SIZE);

    let total = 0;
    let lastDoc = null;

    for (;;) {
        const snapshot = lastDoc ? await query.startAfter(lastDoc).get() : await query.get();
        if (snapshot.empty) break;

        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        total += finalizeVisibleItems(items, bounds, user).length;

        if (snapshot.docs.length < PAGE_SIZE) break;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    return total;
}

async function countExactFirestore(baseQuery, prefixes, bounds, user) {
    const totals = await Promise.all(
        prefixes.map(prefix => countPrefixExact(baseQuery, prefix, bounds, user))
    );
    return totals.reduce((sum, value) => sum + value, 0);
}

function countExactDev(parsed, bounds, user) {
    const items = filterDevShowroomsBase(parsed, user, { includeGeohash: false, includeQName: false });
    return finalizeVisibleItems(items, bounds, user).length;
}

export async function mapShowroomCountersService(filters, user = null) {
    const parsed = parseMapFilters(filters);
    const requestedPrecision = precisionForZoom(parsed.zoom);
    const { precision: queryPrecision, prefixes } = resolveBoundedPrefixes(parsed.bounds, requestedPrecision);

    if (useDevMock) {
        return {
            total: countExactDev(parsed, parsed.bounds, user),
            meta: {
                zoom: parsed.zoom,
                queryPrecision,
                prefixesCount: prefixes.length,
                exact: true,
            },
        };
    }

    const db = getFirestoreInstance();
    const baseQuery = buildBaseQuery(db.collection("showrooms"), parsed, user);

    try {
        const total = await countExactFirestore(baseQuery, prefixes, parsed.bounds, user);
        return {
            total,
            meta: {
                zoom: parsed.zoom,
                queryPrecision,
                prefixesCount: prefixes.length,
                exact: true,
            },
        };
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY", { collection: "showrooms" }, err);
        }
        throw err;
    }
}
