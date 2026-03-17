// Prefix search mode for nameNormalized with Firestore range query.

import { FieldPath } from "firebase-admin/firestore";
import { isCountryBlocked } from "../../../../constants/countries.js";
import {
    applyFieldMode,
    applyVisibilityPostFilter,
    buildMeta,
    scanOrderedQuery,
} from "../utils/index.js";

export async function runNamePrefixMode(baseQuery, parsed) {
    // Name mode is a strict startsWith search over normalized field.
    const query = buildPrefixQuery(baseQuery, "nameNormalized", parsed.qName);
    const { items } = await scanOrderedQuery(query, {
        cursor: parsed.cursor,
        limit: parsed.limit,
        orderField: "nameNormalized",
        transform: item => {
            if (applyVisibilityPostFilter([item], parsed.user).length === 0) return null;
            if (isCountryBlocked(item.country)) return null;
            return item;
        },
    });
    const { pageItems, meta } = buildMeta(items, parsed.limit, "nameNormalized", "asc");
    const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
    return { showrooms, meta };
}

function buildPrefixQuery(baseQuery, field, prefix) {
    // Upper bound with \uf8ff is a common Firestore prefix-search pattern.
    return baseQuery
        .where(field, ">=", prefix)
        .where(field, "<=", `${prefix}\uf8ff`)
        .orderBy(field, "asc")
        .orderBy(FieldPath.documentId(), "asc");
}
