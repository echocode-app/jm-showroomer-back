import { getLookbooksCollection, mapIndexError } from "../firestoreQuery.js";
import { normalizeLookbook } from "../response.js";
import { buildCursorFromItem, compareLookbooks, compareToCursor } from "./sortCursor.js";

export async function fetchNearby(parsed, limit) {
    if (limit <= 0) return [];
    const sorted = await fetchNearbyByGeohashPrefixes(parsed);
    const afterCursor = parsed.cursor
        ? sorted.filter(item => compareToCursor(item, parsed.cursor) > 0)
        : sorted;

    return afterCursor.slice(0, limit).map(item => ({
        payload: item,
        cursor: buildCursorFromItem(item),
    }));
}

async function fetchNearbyByGeohashPrefixes(parsed) {
    if (!Array.isArray(parsed.nearbyGeohashPrefixes) || parsed.nearbyGeohashPrefixes.length === 0) {
        return [];
    }

    const baseQuery = buildNearbyLookbooksQuery(parsed);
    const snaps = await Promise.all(
        parsed.nearbyGeohashPrefixes.map(prefix =>
            baseQuery
                .where("geo.geohash", ">=", prefix)
                .where("geo.geohash", "<=", `${prefix}\uf8ff`)
                .get()
        )
    );

    const byId = new Map();
    for (const snap of snaps) {
        for (const doc of snap.docs) {
            if (!byId.has(doc.id)) {
                const item = normalizeLookbook({ id: doc.id, ...doc.data() });
                if (item.geo?.geohash) {
                    byId.set(doc.id, item);
                }
            }
        }
    }

    return Array.from(byId.values()).sort(compareLookbooks);
}

function buildNearbyLookbooksQuery(parsed) {
    // Keep catalog partition by country; season remains an optional narrowing filter.
    let query = getLookbooksCollection()
        .where("published", "==", true)
        .where("countryNormalized", "==", parsed.countryNormalized);

    if (parsed.seasonKey) {
        query = query.where("seasonKey", "==", parsed.seasonKey);
    }

    return query;
}

export function mapNearbyIndexError(err) {
    mapIndexError(err);
}
