import { FieldPath } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../../config/firebase.js";
import { buildDomainError, isIndexNotReadyError } from "../list/firestore/indexErrors.js";
import { MODERATION_DIRECTION, MODERATION_ORDER_FIELD, MODERATION_STATUS } from "./constants.js";
import { buildModerationCursor } from "./cursor.js";
import { mapModerationDTO } from "./dto.js";
import { filterOutShowroomsWithDeletedOwners } from "./ownerGuard.js";
import { parseModerationQueueQuery } from "./validation.js";

// Moderation queue uses deterministic ordering:
// submittedAt desc + __name__ asc to prevent paging drift.
function buildModerationQueueQuery(db, parsed) {
    let query = db
        .collection("showrooms")
        .where("status", "==", MODERATION_STATUS)
        .orderBy(MODERATION_ORDER_FIELD, MODERATION_DIRECTION)
        .orderBy(FieldPath.documentId(), "asc");

    if (parsed.cursor) {
        // Cursor resumes after the exact last tuple (submittedAt, __name__).
        query = query.startAfter(parsed.cursor.lastValue, parsed.cursor.id);
    }

    return query.limit(parsed.limit + 1);
}

export async function listAdminModerationQueueService(filters = {}) {
    const parsed = parseModerationQueueQuery(filters);
    const db = getFirestoreInstance();

    try {
        const collected = [];
        let scanCursor = parsed.cursor ?? null;
        let exhausted = false;

        while (collected.length <= parsed.limit && !exhausted) {
            const snapshot = await buildModerationQueueQuery(db, {
                ...parsed,
                cursor: scanCursor,
            }).get();
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (items.length === 0) {
                exhausted = true;
                break;
            }

            const filteredItems = await filterOutShowroomsWithDeletedOwners(items);
            collected.push(...filteredItems);

            if (items.length <= parsed.limit) {
                exhausted = true;
                break;
            }

            const lastRawItem = items.at(-1);
            scanCursor = lastRawItem
                ? { lastValue: lastRawItem.submittedAt ?? null, id: lastRawItem.id }
                : null;
        }

        const pageItems = collected.slice(0, parsed.limit);
        const hasMore = collected.length > parsed.limit;
        const last = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1] : null;

        return {
            showrooms: pageItems.map(mapModerationDTO),
            meta: {
                nextCursor: last
                    ? buildModerationCursor({
                          status: parsed.status,
                          lastValue: last?.submittedAt ?? null,
                          id: last.id,
                      })
                    : null,
                hasMore,
                paging: hasMore ? "enabled" : "end",
            },
        };
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY", { collection: "showrooms" }, err);
        }
        throw err;
    }
}
