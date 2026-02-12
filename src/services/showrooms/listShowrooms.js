// Showroom list service entrypoint.
import { useDevMock } from "./_store.js";
import { listShowroomsDev, listShowroomsFirestore, parseFilters } from "./list/index.js";

/**
 * Canonical list flow:
 * 1) Parse and validate query parameters.
 * 2) Pick execution backend (dev mock vs Firestore).
 * 3) Return already-shaped payload with pagination meta.
 */
export async function listShowroomsService(filters = {}, user = null) {
    const parsed = parseFilters(filters);

    if (useDevMock) {
        return listShowroomsDev(parsed, user);
    }

    return listShowroomsFirestore(parsed, user);
}
