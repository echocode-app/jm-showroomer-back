import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { log } from "../../config/logger.js";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { notFound } from "../../core/error.js";
import { createNotification } from "../notifications/notificationService.js";
import { NOTIFICATION_TYPES } from "../notifications/types.js";
import { shouldNotifyActorAction } from "../notifications/selfAction.js";
import { buildEventResponse, compareByStartsAtAsc, isEventPublished, isFutureEvent } from "./eventResponse.js";
import { getEventsCollection } from "./firestoreQuery.js";
import { parseCollectionFilters } from "./parse.js";

const IDS_CHUNK = 100;

export async function markEventWantToVisit(eventId, uid) {
    const db = getFirestoreInstance();
    const eventRef = getEventsCollection().doc(eventId);
    const wantRef = userEventCollection(uid, "events_want_to_visit").doc(eventId);
    const dismissedRef = userEventCollection(uid, "events_dismissed").doc(eventId);
    let applied = false;
    let eventOwnerUid = null;
    let eventName = null;

    // Deterministic apply semantics + mutual exclusion with dismissed.
    await db.runTransaction(async tx => {
        const eventSnap = await tx.get(eventRef);
        const event = eventSnap.exists ? eventSnap.data() : null;
        if (!event || !isEventPublished(event) || isCountryBlocked(event.country)) {
            throw notFound("EVENT_NOT_FOUND");
        }
        eventOwnerUid = typeof event.ownerUid === "string" ? event.ownerUid : null;
        eventName = typeof event.name === "string" ? event.name : null;

        const wantSnap = await tx.get(wantRef);
        if (wantSnap.exists) {
            tx.delete(dismissedRef);
            return;
        }

        tx.set(wantRef, { createdAt: FieldValue.serverTimestamp() });
        tx.delete(dismissedRef);
        applied = true;
    });

    if (applied && shouldNotifyActorAction(eventOwnerUid, uid)) {
        try {
            await createNotification({
                targetUid: eventOwnerUid,
                actorUid: uid,
                type: NOTIFICATION_TYPES.EVENT_WANT_TO_VISIT,
                resourceType: "event",
                resourceId: eventId,
                payload: { eventName },
                dedupeKey: `event:${eventId}:want:${uid}`,
            });
        } catch (err) {
            log.error(
                `Notification write skipped (event want-to-visit ${eventId}): ${err?.message || err}`
            );
        }
    }

    return { applied };
}

export async function removeEventWantToVisit(eventId, uid) {
    const db = getFirestoreInstance();
    const wantRef = userEventCollection(uid, "events_want_to_visit").doc(eventId);
    let removed = false;

    await db.runTransaction(async tx => {
        const wantSnap = await tx.get(wantRef);
        if (!wantSnap.exists) return;
        tx.delete(wantRef);
        removed = true;
    });

    return { removed };
}

export async function dismissEvent(eventId, uid) {
    await assertEventExistsAndPublished(eventId);
    const now = new Date().toISOString();
    const dismissedRef = userEventCollection(uid, "events_dismissed").doc(eventId);
    const wantRef = userEventCollection(uid, "events_want_to_visit").doc(eventId);

    // Idempotent upsert + mutual exclusion with want-to-visit.
    await Promise.all([
        dismissedRef.set({ createdAt: now }, { merge: true }),
        wantRef.delete(),
    ]);
}

export async function undismissEvent(eventId, uid) {
    await userEventCollection(uid, "events_dismissed")
        .doc(eventId)
        .delete();
}

export async function listWantToVisitEvents(uid, filters = {}) {
    const { limit } = parseCollectionFilters(filters);
    const nowTs = timestampNow();
    const ids = await getOrderedCollectionIds(uid, "events_want_to_visit");
    if (ids.length === 0) {
        return { events: [], meta: { total: 0, returned: 0 } };
    }

    const events = await getEventsByIds(ids);
    // Collection can contain stale ids; re-validate visibility rules at read time.
    const filtered = events
        .filter(event => isEventPublished(event))
        .filter(event => !isCountryBlocked(event.country))
        .filter(event => isFutureEvent(event, nowTs))
        .sort(compareByStartsAtAsc);

    const page = filtered.slice(0, limit).map(event =>
        buildEventResponse(event, {
            wantIds: new Set(ids),
            includeDismissed: false,
            dismissedIds: new Set(),
        })
    );

    return {
        events: page,
        meta: {
            total: filtered.length,
            returned: page.length,
        },
    };
}

export async function getUserEventIds(uid, collectionName) {
    const snap = await userEventCollection(uid, collectionName).get();
    // MVP1 reads whole subcollection; optimize with counters/cache in later iterations.
    return new Set(snap.docs.map(doc => doc.id));
}

async function getOrderedCollectionIds(uid, collectionName) {
    // createdAt ordering preserves UX order of user actions in collections.
    const snap = await userEventCollection(uid, collectionName)
        .orderBy("createdAt", "asc")
        .get();
    return snap.docs.map(doc => doc.id);
}

async function getEventsByIds(ids) {
    const db = getFirestoreInstance();
    const refs = ids.map(id => getEventsCollection().doc(id));
    const events = [];

    for (let i = 0; i < refs.length; i += IDS_CHUNK) {
        const chunk = refs.slice(i, i + IDS_CHUNK);
        const snaps = await db.getAll(...chunk);
        snaps.forEach(snap => {
            if (snap.exists) {
                events.push({ id: snap.id, ...snap.data() });
            }
        });
    }

    return events;
}

async function assertEventExistsAndPublished(eventId) {
    const snap = await getEventsCollection().doc(eventId).get();
    const event = snap.exists ? snap.data() : null;
    if (!event || !isEventPublished(event) || isCountryBlocked(event.country)) {
        throw notFound("EVENT_NOT_FOUND");
    }
}

function timestampNow() {
    return Timestamp.fromDate(new Date());
}

function userEventCollection(uid, collectionName) {
    // We keep dedicated user subcollections for simple idempotent writes in MVP1.
    return getFirestoreInstance()
        .collection("users")
        .doc(uid)
        .collection(collectionName);
}
