import { Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { badRequest } from "../../core/error.js";
import { isEventPublished, isFutureEvent } from "./eventResponse.js";
import { getEventsCollection } from "./firestoreQuery.js";

const MAX_SYNC_IDS_PER_LIST = 100;
const IDS_CHUNK = 100;

export async function syncGuestEventsState(uid, payload = {}) {
    const { wantToVisitIds, dismissedIds } = parseSyncPayload(payload);
    const nowTs = Timestamp.fromDate(new Date());
    const nowIso = nowTs.toDate().toISOString();

    const allIds = Array.from(new Set([...wantToVisitIds, ...dismissedIds]));
    if (allIds.length === 0) {
        return {
            applied: { wantToVisit: [], dismissed: [] },
            skipped: [],
        };
    }

    const eventsById = await getEventsByIds(allIds);
    const allowedIds = new Set();
    const skipped = [];

    // Invalid, unpublished, blocked-country, and past events are silently skipped.
    for (const id of allIds) {
        const event = eventsById.get(id);
        if (!event) {
            skipped.push(id);
            continue;
        }
        if (!isEventPublished(event) || isCountryBlocked(event.country) || !isFutureEvent(event, nowTs)) {
            skipped.push(id);
            continue;
        }
        allowedIds.add(id);
    }

    const appliedWantToVisit = wantToVisitIds.filter(id => allowedIds.has(id));
    const appliedDismissed = dismissedIds.filter(id => allowedIds.has(id));

    // Persist merged state atomically to avoid cross-collection drift.
    await applyUserStateBatch(uid, {
        wantToVisitIds: appliedWantToVisit,
        dismissedIds: appliedDismissed,
        createdAt: nowIso,
    });

    return {
        applied: {
            wantToVisit: appliedWantToVisit,
            dismissed: appliedDismissed,
        },
        skipped,
    };
}

function parseSyncPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw badRequest("QUERY_INVALID");
    }
    const allowedKeys = new Set(["wantToVisitIds", "dismissedIds"]);
    const unknownKeys = Object.keys(payload).filter(key => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
        throw badRequest("QUERY_INVALID");
    }

    const wantToVisitIds = parseIdsList(payload.wantToVisitIds);
    const dismissedSource = parseIdsList(payload.dismissedIds);

    const wantSet = new Set(wantToVisitIds);
    // Mutual exclusion: if duplicated across lists, want-to-visit wins.
    const dismissedIds = dismissedSource.filter(id => !wantSet.has(id));

    return {
        wantToVisitIds,
        dismissedIds,
    };
}

function parseIdsList(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw badRequest("QUERY_INVALID");
    }
    if (value.length > MAX_SYNC_IDS_PER_LIST) {
        throw badRequest("EVENT_SYNC_LIMIT_EXCEEDED");
    }

    const normalized = [];
    const seen = new Set();
    for (const raw of value) {
        if (typeof raw !== "string") {
            throw badRequest("QUERY_INVALID");
        }
        const id = raw.trim();
        if (!id) {
            throw badRequest("QUERY_INVALID");
        }
        if (!seen.has(id)) {
            normalized.push(id);
            seen.add(id);
        }
    }

    return normalized;
}

async function getEventsByIds(ids) {
    const db = getFirestoreInstance();
    const refs = ids.map(id => getEventsCollection().doc(id));
    const eventsById = new Map();

    for (let i = 0; i < refs.length; i += IDS_CHUNK) {
        const chunk = refs.slice(i, i + IDS_CHUNK);
        const snaps = await db.getAll(...chunk);
        snaps.forEach(snap => {
            if (snap.exists) {
                eventsById.set(snap.id, { id: snap.id, ...snap.data() });
            }
        });
    }

    return eventsById;
}

async function applyUserStateBatch(uid, { wantToVisitIds, dismissedIds, createdAt }) {
    const db = getFirestoreInstance();
    const batch = db.batch();
    const hasWrites = wantToVisitIds.length > 0 || dismissedIds.length > 0;

    if (!hasWrites) return;

    for (const eventId of wantToVisitIds) {
        const wantRef = userEventCollection(uid, "events_want_to_visit").doc(eventId);
        const dismissedRef = userEventCollection(uid, "events_dismissed").doc(eventId);
        batch.set(wantRef, { createdAt }, { merge: true });
        batch.delete(dismissedRef);
    }

    for (const eventId of dismissedIds) {
        const dismissedRef = userEventCollection(uid, "events_dismissed").doc(eventId);
        const wantRef = userEventCollection(uid, "events_want_to_visit").doc(eventId);
        batch.set(dismissedRef, { createdAt }, { merge: true });
        batch.delete(wantRef);
    }

    await batch.commit();
}

function userEventCollection(uid, collectionName) {
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection(collectionName);
}
