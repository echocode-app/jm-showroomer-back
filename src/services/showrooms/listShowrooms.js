// Showroom list service entrypoint.
import { useDevMock } from "./_store.js";
import { listShowroomsDev, listShowroomsFirestore, parseFilters } from "./list/index.js";

// listShowroomsService
export async function listShowroomsService(filters = {}, user = null) {
    const parsed = parseFilters(filters);

    if (useDevMock) {
        return listShowroomsDev(parsed, user);
    }

    return listShowroomsFirestore(parsed, user);
}
