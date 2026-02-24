import { getFirestoreInstance } from "../../config/firebase.js";
import { log } from "../../config/logger.js";

const COLLECTION_NAME = "analytics_events";

export async function record(eventDraft, options = {}) {
    const logger = options?.logger ?? log;
    try {
        if (!eventDraft || typeof eventDraft !== "object") return { ok: false };

        const db = getFirestoreInstance();
        const eventId = String(eventDraft.eventId || "").trim();
        if (!eventId) return { ok: false };

        const timestamp = typeof eventDraft.timestamp === "string"
            ? eventDraft.timestamp
            : new Date().toISOString();
        const eventDate = timestamp.slice(0, 10);
        const actorId = eventDraft?.user?.actorId ?? null;
        const eventName = eventDraft?.eventName ?? null;
        const resourceType = eventDraft?.resource?.type ?? null;
        const resourceId = eventDraft?.resource?.id ?? null;

        await db.collection(COLLECTION_NAME).doc(eventId).set({
            ...eventDraft,
            eventDate,
            actorId,
            eventName,
            resourceType,
            resourceId,
        });

        return { ok: true, eventId };
    } catch (err) {
        logger.error(`analytics.record failed: ${err?.message || err}`);
        return { ok: false };
    }
}

export async function recordBatch(eventDrafts = [], options = {}) {
    const logger = options?.logger ?? log;
    try {
        const drafts = Array.isArray(eventDrafts) ? eventDrafts : [];
        logger.info(`analytics.ingest batch_size=${drafts.length}`);
        if (drafts.length === 0) {
            return { accepted: 0, stored: 0, failed: 0 };
        }

        const results = await Promise.allSettled(
            drafts.map(draft => record(draft, { logger }))
        );
        let stored = 0;
        let failed = 0;

        results.forEach(result => {
            if (result.status === "fulfilled" && result.value?.ok) {
                stored += 1;
                return;
            }
            failed += 1;
            if (result.status === "rejected") {
                logger.error(`analytics.recordBatch item failed: ${result.reason?.message || result.reason}`);
            }
        });

        return {
            accepted: drafts.length,
            stored,
            failed,
        };
    } catch (err) {
        logger.error(`analytics.recordBatch failed: ${err?.message || err}`);
        return {
            accepted: Array.isArray(eventDrafts) ? eventDrafts.length : 0,
            stored: 0,
            failed: Array.isArray(eventDrafts) ? eventDrafts.length : 0,
        };
    }
}
