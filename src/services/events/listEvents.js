import { Timestamp } from "firebase-admin/firestore";
import { isCountryBlocked } from "../../constants/countries.js";
import { buildEventResponse, toTimestamp, toIsoString } from "./eventResponse.js";
import {
    applyEventsOrdering,
    buildPublicEventsBaseQuery,
    mapIndexError,
} from "./firestoreQuery.js";
import { encodeListCursor, parseListFilters } from "./parse.js";
import { getUserEventIds } from "./userEventState.js";

export async function listEvents(filters = {}, user = null) {
    const parsed = parseListFilters(filters);
    const nowTs = Timestamp.fromDate(new Date());

    const uid = user?.uid ?? null;
    // Load user state once per request; used for post-read filtering and flags.
    const [dismissedIds, wantIds] = uid
        ? await Promise.all([
            getUserEventIds(uid, "events_dismissed"),
            getUserEventIds(uid, "events_want_to_visit"),
        ])
        : [new Set(), new Set()];

    const baseQuery = buildPublicEventsBaseQuery({
        nowTs,
        country: parsed.country,
        cityNormalized: parsed.cityNormalized,
    });

    const events = [];
    // Read in chunks because some filters (blocked country, dismissed) are post-query.
    const batchSize = Math.max(parsed.limit + 1, 50);
    let seek = parsed.cursor;
    let hasRawMore = true;

    try {
        // We progressively fetch raw pages because filtering happens after read
        // (blocked countries + dismissed). This preserves correct hasMore semantics.
        while (events.length < parsed.limit + 1 && hasRawMore) {
            let query = applyEventsOrdering(baseQuery);
            if (seek) {
                query = query.startAfter(seek.startsAtTs, seek.id);
            }
            query = query.limit(batchSize);

            const snap = await query.get();
            if (snap.empty) {
                hasRawMore = false;
                break;
            }

            hasRawMore = snap.docs.length === batchSize;
            const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filtered = docs
                // Ignore malformed timestamps to keep cursor and sort guarantees intact.
                .filter(event => Boolean(toTimestamp(event.startsAt)))
                .filter(event => !isCountryBlocked(event.country))
                .filter(event => !dismissedIds.has(event.id));

            filtered.forEach(event => {
                if (events.length < parsed.limit + 1) {
                    events.push(
                        buildEventResponse(event, {
                            wantIds,
                            includeDismissed: false,
                            dismissedIds,
                        })
                    );
                }
            });

            const lastRaw = snap.docs[snap.docs.length - 1];
            seek = {
                startsAtTs: toTimestamp(lastRaw.data().startsAt),
                id: lastRaw.id,
            };

            if (!seek.startsAtTs) {
                hasRawMore = false;
            }
        }
    } catch (err) {
        mapIndexError(err);
    }

    const hasMore = events.length > parsed.limit;
    const pageItems = events.slice(0, parsed.limit);
    const last = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && last
        ? encodeListCursor({
            startsAtIso: toIsoString(last.startsAt),
            id: last.id,
        })
        : null;

    return {
        events: pageItems,
        meta: {
            hasMore,
            nextCursor,
            paging: hasMore ? "enabled" : "end",
        },
    };
}
