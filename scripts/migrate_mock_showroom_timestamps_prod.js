// Migrate seeded/mock showroom timestamp fields from ISO strings to Firestore Timestamp in prod.
// Usage:
//   NODE_ENV=prod CONFIRM_PROD_MIGRATION=YES node scripts/migrate_mock_showroom_timestamps_prod.js

import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const ENV = process.env.NODE_ENV || "dev";
if (ENV !== "prod") {
    console.error("Refusing to run: NODE_ENV must be 'prod'.");
    process.exit(1);
}
if (process.env.CONFIRM_PROD_MIGRATION !== "YES") {
    console.error("Refusing to run in prod without CONFIRM_PROD_MIGRATION=YES.");
    process.exit(1);
}

function isSeededShowroom(data = {}) {
    return data?.source === "seed" || typeof data?.seedBatch === "string" || typeof data?.seedTag === "string";
}

function parseTimestampString(value) {
    if (typeof value !== "string") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Timestamp.fromDate(date);
}

function migrateHistory(history) {
    if (!Array.isArray(history)) return null;
    let changed = false;
    const next = history.map(entry => {
        if (!entry || typeof entry !== "object") return entry;
        const at = parseTimestampString(entry.at);
        if (!at) return entry;
        changed = true;
        return { ...entry, at };
    });
    return changed ? next : null;
}

function buildUpdates(data) {
    const updates = {};
    let changed = false;

    for (const field of ["createdAt", "updatedAt", "submittedAt", "reviewedAt", "deletedAt"]) {
        const parsed = parseTimestampString(data?.[field]);
        if (parsed) {
            updates[field] = parsed;
            changed = true;
        }
    }

    const migratedHistory = migrateHistory(data?.editHistory);
    if (migratedHistory) {
        updates.editHistory = migratedHistory;
        changed = true;
    }

    return changed ? updates : null;
}

async function main() {
    initFirebase();
    const db = getFirestoreInstance();

    const snapshot = await db.collection("showrooms").get();
    const targets = snapshot.docs.filter(doc => isSeededShowroom(doc.data()));

    let scanned = 0;
    let updated = 0;
    let batch = db.batch();
    let batchOps = 0;

    for (const doc of targets) {
        scanned += 1;
        const updates = buildUpdates(doc.data());
        if (!updates) continue;
        batch.update(doc.ref, updates);
        batchOps += 1;
        updated += 1;

        if (batchOps >= 400) {
            await batch.commit();
            batch = db.batch();
            batchOps = 0;
        }
    }

    if (batchOps > 0) {
        await batch.commit();
    }

    console.log(JSON.stringify({ scanned, updated }, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
