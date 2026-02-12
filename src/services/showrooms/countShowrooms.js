// Service: showroom counters.

import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { useDevMock } from "./_store.js";
import { countForPrefix } from "./count/firestore.js";
import { countItems } from "./count/helpers.js";
import { filterDevShowroomsBase } from "./list/devFilters.js";
import { parseCountersFilters } from "./list/parse/counters.js";

/**
 * Counts showrooms for the same filter grammar used by list/suggestions endpoints.
 */
export async function countShowroomsService(filters = {}, user = null) {
    const parsed = parseCountersFilters(filters);
    // Fast exit: blocked country filter is known-empty and does not require DB scans.
    if (parsed.raw?.country && isCountryBlocked(parsed.raw.country)) {
        const mode =
            parsed.geohashPrefixes.length > 1
                ? "multi_prefix"
                : parsed.geohashPrefixes.length === 1
                  ? "single_prefix"
                  : "no_geo";
        return {
            total: 0,
            meta: {
                mode,
                prefixesCount: parsed.geohashPrefixes.length,
            },
        };
    }
    if (useDevMock) {
        return countShowroomsDev(parsed, user);
    }

    const db = getFirestoreInstance();

    // Multi-prefix map mode runs one count per prefix and sums the buckets.
    if (parsed.geohashPrefixes.length > 1) {
        const totals = await Promise.all(
            parsed.geohashPrefixes.map(prefix =>
                countForPrefix(db, parsed, user, prefix)
            )
        );
        const total = totals.reduce((sum, v) => sum + v, 0);
        return {
            total,
            meta: { mode: "multi_prefix", prefixesCount: parsed.geohashPrefixes.length },
        };
    }

    const total = await countForPrefix(
        db,
        parsed,
        user,
        parsed.geohashPrefixes[0] ?? null
    );

    return {
        total,
        meta: {
            mode: parsed.geohashPrefixes.length === 1 ? "single_prefix" : "no_geo",
            prefixesCount: parsed.geohashPrefixes.length,
        },
    };
}

/**
 * Runs counter logic against DEV_STORE to mirror production behavior locally.
 */
function countShowroomsDev(parsed, user) {
    // Reuse shared base filters so dev counter semantics match production.
    const items = filterDevShowroomsBase(parsed, user);

    if (parsed.geohashPrefixes.length > 1) {
        const total = parsed.geohashPrefixes.reduce((sum, prefix) => {
            return sum + countItems(items, parsed, prefix);
        }, 0);
        return {
            total,
            meta: { mode: "multi_prefix", prefixesCount: parsed.geohashPrefixes.length },
        };
    }

    const total = countItems(items, parsed, parsed.geohashPrefixes[0] ?? null);
    return {
        total,
        meta: {
            mode: parsed.geohashPrefixes.length === 1 ? "single_prefix" : "no_geo",
            prefixesCount: parsed.geohashPrefixes.length,
        },
    };
}
