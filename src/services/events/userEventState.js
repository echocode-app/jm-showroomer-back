import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { log } from "../../config/logger.js";
import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { notFound } from "../../core/error.js";
import { createNotification } from "../notifications/notificationService.js";
import { NOTIFICATION_TYPES } from "../notifications/types.js";
import { shouldNotifyActorAction } from "../notifications/selfAction.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { buildEventResponse, compareByStartsAtAsc, isEventPublished, isFutureEvent } from "./eventResponse.js";
import { getEventsCollection } from "./firestoreQuery.js";
import { encodeCollectionCursor, parseCollectionFilters } from "./parse.js";
import { buildAnalyticsEvent } from "../analytics/analyticsEventBuilder.js";
import { record } from "../analytics/analyticsEventService.js";
import { ANALYTICS_EVENTS } from "../analytics/eventNames.js";

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
        await assertUserWritableInTx(tx, uid);
        const eventSnap = await tx.get(eventRef);
        const event = eventSnap.exists ? eventSnap.data() : null;
        if (!event || !isEventPublished(event) || isCountryBlocked(event.country)) {
            throw notFound("EVENT_NOT_FOUND");
        }
        const currentCount = getWantToVisitCount(event);
        eventOwnerUid = typeof event.ownerUid === "string" ? event.ownerUid : null;
        eventName = typeof event.name === "string" ? event.name : null;

        const wantSnap = await tx.get(wantRef);
        if (wantSnap.exists) {
            tx.delete(dismissedRef);
            return;
        }

        tx.set(wantRef, { createdAt: FieldValue.serverTimestamp() });
        tx.delete(dismissedRef);
        tx.update(eventRef, { wantToVisitCount: currentCount + 1 });
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

    if (applied) {
        try {
            await record(buildAnalyticsEvent({
                eventName: ANALYTICS_EVENTS.EVENT_WANT_TO_VISIT,
                source: "server",
                actor: {
                    userId: uid,
                    isAnonymous: false,
                },
                context: {
                    surface: "event_detail",
                },
                resource: {
                    type: "event",
                    id: eventId,
                    ownerUserId: eventOwnerUid,
                },
                meta: {
                    producer: "backend_api",
                },
            }));
        } catch (err) {
            log.error(`Analytics emit failed (event_want_to_visit ${eventId}): ${err?.message || err}`);
        }
    }

    return { applied };
}

export async function removeEventWantToVisit(eventId, uid) {
    const db = getFirestoreInstance();
    const eventRef = getEventsCollection().doc(eventId);
    const wantRef = userEventCollection(uid, "events_want_to_visit").doc(eventId);
    let removed = false;

    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        const wantSnap = await tx.get(wantRef);
        if (!wantSnap.exists) return;
        const eventSnap = await tx.get(eventRef);
        const event = eventSnap.exists ? eventSnap.data() : null;
        tx.delete(wantRef);
        if (event) {
            tx.update(eventRef, {
                wantToVisitCount: Math.max(0, getWantToVisitCount(event) - 1),
            });
        }
        removed = true;
    });

    if (removed) {
        try {
            await record(buildAnalyticsEvent({
                eventName: ANALYTICS_EVENTS.EVENT_REMOVE_WANT_TO_VISIT,
                source: "server",
                actor: {
                    userId: uid,
                    isAnonymous: false,
                },
                context: {
                    surface: "event_detail",
                },
                resource: {
                    type: "event",
                    id: eventId,
                },
                meta: {
                    producer: "backend_api",
                },
            }));
        } catch (err) {
            log.error(`Analytics emit failed (event_remove_want_to_visit ${eventId}): ${err?.message || err}`);
        }
    }

    return { removed };
}

export async function dismissEvent(eventId, uid) {
    const db = getFirestoreInstance();
    const eventRef = getEventsCollection().doc(eventId);
    const now = new Date().toISOString();
    const dismissedRef = userEventCollection(uid, "events_dismissed").doc(eventId);
    const wantRef = userEventCollection(uid, "events_want_to_visit").doc(eventId);

    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        const eventSnap = await tx.get(eventRef);
        const event = eventSnap.exists ? eventSnap.data() : null;
        if (!event || !isEventPublished(event) || isCountryBlocked(event.country)) {
            throw notFound("EVENT_NOT_FOUND");
        }
        const wantSnap = await tx.get(wantRef);
        // Idempotent upsert + mutual exclusion with want-to-visit.
        tx.set(dismissedRef, { createdAt: now }, { merge: true });
        tx.delete(wantRef);
        if (wantSnap.exists) {
            tx.update(eventRef, {
                wantToVisitCount: Math.max(0, getWantToVisitCount(event) - 1),
            });
        }
    });
}

export async function undismissEvent(eventId, uid) {
    const db = getFirestoreInstance();
    const dismissedRef = userEventCollection(uid, "events_dismissed").doc(eventId);
    await db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, uid);
        tx.delete(dismissedRef);
    });
}

export async function listWantToVisitEvents(uid, filters = {}) {
    const { limit, cursor } = parseCollectionFilters(filters);
    const nowTs = timestampNow();
    const entries = await getOrderedCollectionEntries(uid, "events_want_to_visit");
    if (entries.length === 0) {
        return {
            events: [],
            meta: buildCollectionPagingMeta({ total: 0, returned: 0, pageEntries: [], hasMore: false }),
        };
    }

    const events = await getEventsByIds(entries.map(entry => entry.id));
    const entryById = new Map(entries.map(entry => [entry.id, entry]));
    // Collection can contain stale ids; re-validate visibility rules at read time.
    const filteredEntries = events
        .filter(event => isEventPublished(event))
        .filter(event => !isCountryBlocked(event.country))
        .filter(event => isFutureEvent(event, nowTs))
        .sort(compareByStartsAtAsc)
        .map(event => ({ ...entryById.get(event.id), event }))
        .filter(entry => entry.id);

    const startIndex = cursor
        ? filteredEntries.findIndex(entry => entry.id === cursor.id && entry.createdAtIso === cursor.createdAtIso) + 1
        : 0;
    const normalizedStartIndex = startIndex > 0 ? startIndex : 0;
    const pageEntries = filteredEntries.slice(normalizedStartIndex, normalizedStartIndex + limit);
    const hasMore = normalizedStartIndex + limit < filteredEntries.length;

    const wantIds = new Set(entries.map(entry => entry.id));
    const page = pageEntries.map(entry =>
        buildEventResponse(entry.event, {
            wantIds,
            includeDismissed: false,
            dismissedIds: new Set(),
        })
    );

    return {
        events: page,
        meta: buildCollectionPagingMeta({
            total: filteredEntries.length,
            returned: page.length,
            pageEntries,
            hasMore,
        }),
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

async function getOrderedCollectionEntries(uid, collectionName) {
    const snap = await userEventCollection(uid, collectionName)
        .orderBy("createdAt", "asc")
        .get();

    return snap.docs.map(doc => ({
        id: doc.id,
        createdAtIso: normalizeCreatedAt(doc.data()?.createdAt),
    }));
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

function buildCollectionPagingMeta({ total, returned, pageEntries, hasMore }) {
    const last = pageEntries[pageEntries.length - 1] ?? null;
    const nextCursor = hasMore && last
        ? encodeCollectionCursor({ createdAtIso: last.createdAtIso, id: last.id })
        : null;

    return {
        total,
        returned,
        hasMore,
        nextCursor,
        paging: hasMore ? "enabled" : "end",
    };
}

function normalizeCreatedAt(value) {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") {
        const ms = Date.parse(value);
        if (Number.isFinite(ms)) return new Date(ms).toISOString();
    }
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (typeof value?._seconds === "number") {
        return new Date(value._seconds * 1000).toISOString();
    }
    return new Date(0).toISOString();
}

function getWantToVisitCount(event) {
    const value = event?.wantToVisitCount;
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    return Math.floor(value);
}
