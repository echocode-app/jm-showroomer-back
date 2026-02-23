import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { getFirestoreInstance } from "../src/config/firebase.js";

const ENV = process.env.NODE_ENV || "dev";
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

try {
    await fs.access(envFile);
    dotenv.config({ path: envFile });
} catch {
    // allow runtime env only
}

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has("--dry-run");
const allowProd = argSet.has("--allow-prod");
const uid = readArgValue(args, "--uid");

if (!uid) {
    console.error("❌ Missing required --uid <FIREBASE_UID>");
    process.exit(1);
}

if (ENV === "prod" && !allowProd) {
    console.error("❌ Refusing to cleanup user blockers in prod without --allow-prod");
    process.exit(1);
}

const db = getFirestoreInstance();
const ACTIVE_SHOWROOM_STATUSES = ["draft", "pending", "approved", "rejected"];

const summary = {
    uid,
    dryRun,
    showroomsSoftDeleted: 0,
    showroomsAlreadyDeleted: 0,
    lookbooksDeleted: 0,
    eventsDeleted: 0,
    found: {
        showrooms: [],
        lookbooks: [],
        events: [],
    },
};

async function main() {
    console.log(`Cleanup user blockers (env=${ENV}, uid=${uid}, dryRun=${dryRun})`);

    await cleanupShowrooms(uid);
    await cleanupLookbooks(uid);
    await cleanupEvents(uid);

    console.log("Done.");
    console.log(JSON.stringify(summary, null, 2));
}

async function cleanupShowrooms(ownerUid) {
    const snap = await db
        .collection("showrooms")
        .where("ownerUid", "==", ownerUid)
        .get();

    if (snap.empty) return;

    let batch = db.batch();
    let pendingWrites = 0;
    const now = new Date().toISOString();

    for (const doc of snap.docs) {
        const data = doc.data() || {};
        const status = data.status ?? null;
        summary.found.showrooms.push({ id: doc.id, status });

        if (status === "deleted") {
            summary.showroomsAlreadyDeleted += 1;
            continue;
        }
        if (!ACTIVE_SHOWROOM_STATUSES.includes(status)) {
            // Unknown statuses are still treated as blockers conservatively -> soft-delete.
        }

        summary.showroomsSoftDeleted += 1;
        if (dryRun) continue;

        batch.update(doc.ref, {
            status: "deleted",
            deletedAt: data.deletedAt || now,
            updatedAt: now,
            deletedBy: { uid: "script:cleanup_user_blockers", role: "system" },
        });
        pendingWrites += 1;
        if (pendingWrites >= 400) {
            await batch.commit();
            batch = db.batch();
            pendingWrites = 0;
        }
    }

    if (!dryRun && pendingWrites > 0) {
        await batch.commit();
    }
}

async function cleanupLookbooks(ownerUid) {
    const refsByPath = new Map();
    const [authorSnap, legacySnap] = await Promise.all([
        db.collection("lookbooks").where("authorId", "==", ownerUid).get(),
        db.collection("lookbooks").where("ownerUid", "==", ownerUid).get(),
    ]);

    for (const doc of [...authorSnap.docs, ...legacySnap.docs]) {
        refsByPath.set(doc.ref.path, doc);
    }

    if (refsByPath.size === 0) return;

    let batch = db.batch();
    let pendingWrites = 0;
    for (const doc of refsByPath.values()) {
        const data = doc.data() || {};
        summary.found.lookbooks.push({
            id: doc.id,
            authorId: data.authorId ?? null,
            ownerUid: data.ownerUid ?? null,
        });
        summary.lookbooksDeleted += 1;
        if (dryRun) continue;

        batch.delete(doc.ref);
        pendingWrites += 1;
        if (pendingWrites >= 400) {
            await batch.commit();
            batch = db.batch();
            pendingWrites = 0;
        }
    }

    if (!dryRun && pendingWrites > 0) {
        await batch.commit();
    }
}

async function cleanupEvents(ownerUid) {
    const snap = await db.collection("events").where("ownerUid", "==", ownerUid).get();
    if (snap.empty) return;

    let batch = db.batch();
    let pendingWrites = 0;
    for (const doc of snap.docs) {
        const data = doc.data() || {};
        summary.found.events.push({
            id: doc.id,
            ownerUid: data.ownerUid ?? null,
            status: data.status ?? null,
        });
        summary.eventsDeleted += 1;
        if (dryRun) continue;

        batch.delete(doc.ref);
        pendingWrites += 1;
        if (pendingWrites >= 400) {
            await batch.commit();
            batch = db.batch();
            pendingWrites = 0;
        }
    }

    if (!dryRun && pendingWrites > 0) {
        await batch.commit();
    }
}

function readArgValue(argv, flag) {
    const idx = argv.indexOf(flag);
    if (idx < 0) return null;
    return argv[idx + 1] || null;
}

await main();
