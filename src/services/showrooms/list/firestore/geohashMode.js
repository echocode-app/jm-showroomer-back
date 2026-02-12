// Geohash mode: query per prefix, merge, sort, and paginate in-memory.

import { isCountryBlocked } from "../../../../constants/countries.js";
import { FieldPath } from "firebase-admin/firestore";
import {
    applyFieldMode,
    applyVisibilityPostFilter,
    buildMeta,
    compareValues,
    getValueByPath,
    mergeSnapshots,
} from "../utils/index.js";

export async function runGeohashMode(baseQuery, parsed, user, orderField, direction) {
    // Single-prefix mode can continue from cursor; multi-prefix mode cannot do stable cursor paging.
    const isSinglePrefix = parsed.geohashPrefixes.length === 1;
    const cursor = isSinglePrefix ? parsed.cursor : null;

    // Run one bounded query per prefix and merge results afterwards.
    const snapshots = await Promise.all(
        parsed.geohashPrefixes.map(prefix =>
            buildGeohashQuery(
                baseQuery,
                prefix,
                parsed,
                orderField,
                direction,
                cursor
            ).get()
        )
    );

    // Merge + post-filter is required because some constraints are not encoded directly in all queries.
    let items = mergeSnapshots(snapshots);
    items = applyVisibilityPostFilter(items, user);
    items = items.filter(s => !isCountryBlocked(s.country));

    if (parsed.qName) {
        // Safety gate: geohash + qName is rejected by parser, this branch is defensive.
        items = items.filter(s => {
            const nameOk = parsed.qName
                ? String(s.nameNormalized ?? "").startsWith(parsed.qName)
                : false;
            return nameOk;
        });
    }

    // Final sort in memory to keep deterministic order after multi-query merge.
    items.sort((a, b) => {
        const cmp = compareValues(
            getValueByPath(a, orderField),
            getValueByPath(b, orderField),
            direction
        );
        if (cmp !== 0) return cmp;
        return a.id.localeCompare(b.id);
    });

    if (parsed.cursorDisabled) {
        // Explicit contract: map multi-prefix mode returns first page with paging=disabled.
        const { pageItems, meta } = buildMeta(items, parsed.limit, orderField, direction, {
            paging: "disabled",
            reason: "multi_geohash_prefixes",
        });
        const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
        return { showrooms, meta };
    }

    const { pageItems, meta } = buildMeta(
        items,
        parsed.limit,
        orderField,
        direction
    );
    const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
    return { showrooms, meta };
}

function buildGeohashQuery(baseQuery, prefix, parsed, orderField, direction, cursor) {
    // Prefix range [prefix, prefix+\uf8ff] selects all descendant geohashes in this area bucket.
    let query = baseQuery
        .where("geo.geohash", ">=", prefix)
        .where("geo.geohash", "<=", `${prefix}\uf8ff`);
    query = applyOrdering(query, orderField, direction);
    if (cursor) {
        query = query.startAfter(cursor.value, cursor.id);
    }
    query = query.limit(parsed.limit + 1);
    return query;
}

function applyOrdering(query, orderField, direction) {
    query = query.orderBy(orderField, direction);
    query = query.orderBy(FieldPath.documentId(), "asc");
    return query;
}
