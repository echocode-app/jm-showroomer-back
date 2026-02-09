// In-memory cursor filter for merged result sets.

import { compareValues, getValueByPath } from "./values.js";

export function applyCursorFilter(items, cursor, orderField, direction) {
    if (!cursor) return items;
    return items.filter(item => {
        const value = getValueByPath(item, orderField);
        const cmp = compareValues(value, cursor.value, direction);
        if (cmp === 0) {
            return item.id > cursor.id;
        }
        return cmp > 0;
    });
}
