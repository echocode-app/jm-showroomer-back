// Prefix search mode for nameNormalized with Firestore range query.

import { FieldPath } from "firebase-admin/firestore";
import { isCountryBlocked } from "../../../../constants/countries.js";
import { applyFieldMode, applyVisibilityPostFilter, buildMeta } from "../utils/index.js";

export async function runNamePrefixMode(baseQuery, parsed) {
    // Name mode is a strict startsWith search over normalized field.
    let query = buildPrefixQuery(baseQuery, "nameNormalized", parsed.qName);
    if (parsed.cursor) {
        // Cursor carries last seen normalized name + id.
        query = query.startAfter(parsed.cursor.value, parsed.cursor.id);
    }
    query = query.limit(parsed.limit + 1);

    const snapshot = await query.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Post filters keep behavior consistent with other list modes.
    items = applyVisibilityPostFilter(items, parsed.user);
    items = items.filter(s => !isCountryBlocked(s.country));
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
