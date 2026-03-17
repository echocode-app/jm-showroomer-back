// Ordered Firestore page collector that keeps filling the page after post-filters.

import { MAX_SCAN } from "../parse/constants.js";
import { getValueByPath } from "./values.js";

export async function scanOrderedQuery(baseQuery, { cursor, limit, orderField, minBatchSize = 20, transform }) {
    const target = limit + 1;
    const items = [];
    let scanned = 0;
    let pageCursor = cursor ?? null;

    while (items.length < target && scanned < MAX_SCAN) {
        const remainingScan = MAX_SCAN - scanned;
        const batchSize = Math.min(remainingScan, Math.max(minBatchSize, target - items.length + 1));

        let query = baseQuery;
        if (pageCursor) {
            query = query.startAfter(pageCursor.value, pageCursor.id);
        }
        query = query.limit(batchSize);

        const snapshot = await query.get();
        if (snapshot.empty) break;

        scanned += snapshot.docs.length;

        for (const doc of snapshot.docs) {
            const item = { id: doc.id, ...doc.data() };
            const transformed = transform ? transform(item) : item;
            if (transformed) items.push(transformed);
            if (items.length >= target) break;
        }

        if (snapshot.docs.length < batchSize) break;

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        const lastItem = { id: lastDoc.id, ...lastDoc.data() };
        pageCursor = {
            value: getValueByPath(lastItem, orderField),
            id: lastDoc.id,
        };
    }

    return { items, scanned };
}
