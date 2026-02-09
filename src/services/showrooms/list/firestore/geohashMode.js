// Geohash mode: query per prefix, merge, sort, and paginate in-memory.

import { isCountryBlocked } from "../../../../constants/countries.js";
import { FieldPath } from "firebase-admin/firestore";
import {
    applyCursorFilter,
    applyFieldMode,
    applyVisibilityPostFilter,
    buildMeta,
    compareValues,
    getValueByPath,
    mergeSnapshots,
} from "../utils/index.js";

export async function runGeohashMode(baseQuery, parsed, user, orderField, direction) {
    const snapshots = await Promise.all(
        parsed.geohashPrefixes.map(prefix =>
            buildGeohashQuery(baseQuery, prefix, parsed, orderField, direction).get()
        )
    );

    let items = mergeSnapshots(snapshots);
    items = applyVisibilityPostFilter(items, user);
    items = items.filter(s => !isCountryBlocked(s.country));

    if (parsed.qName) {
        items = items.filter(s => {
            const nameOk = parsed.qName
                ? String(s.nameNormalized ?? "").startsWith(parsed.qName)
                : false;
            return nameOk;
        });
    }

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
        const { pageItems, meta } = buildMeta(items, parsed.limit, orderField, direction, {
            paging: "disabled",
            reason: "multi_geohash_prefixes",
        });
        const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
        return { showrooms, meta };
    }

    const cursorFiltered = applyCursorFilter(items, parsed.cursor, orderField, direction);
    const { pageItems, meta } = buildMeta(
        cursorFiltered,
        parsed.limit,
        orderField,
        direction
    );
    const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
    return { showrooms, meta };
}

function buildGeohashQuery(baseQuery, prefix, parsed, orderField, direction) {
    let query = baseQuery
        .where("geo.geohash", ">=", prefix)
        .where("geo.geohash", "<=", `${prefix}\uf8ff`);
    query = applyOrdering(query, orderField, direction);
    query = query.limit(parsed.limit + 1);
    return query;
}

function applyOrdering(query, orderField, direction) {
    query = query.orderBy(orderField, direction);
    query = query.orderBy(FieldPath.documentId(), "asc");
    return query;
}
