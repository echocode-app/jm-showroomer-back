import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { FieldPath } from "firebase-admin/firestore";
import { getFirestoreInstance, getStorageInstance } from "../src/config/firebase.js";

const ENV = process.env.NODE_ENV || "dev";
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

try {
    await fs.access(envFile);
    dotenv.config({ path: envFile });
} catch {
    // allow runtime env only
}

const args = new Set(process.argv.slice(2));
const prefixArg = process.argv.find(v => v.startsWith("--prefix="));
const dryRun = args.has("--dry-run");
const withStorage = args.has("--with-storage");

if (!prefixArg) {
    console.error("Missing required argument: --prefix=<seed-prefix>");
    process.exit(1);
}

const prefix = prefixArg.split("=").slice(1).join("=");
if (!prefix || !prefix.trim()) {
    console.error("Empty prefix in --prefix argument.");
    process.exit(1);
}

const db = getFirestoreInstance();
const storage = getStorageInstance();
const bucket = storage.bucket();

async function fetchDocsByPrefix(collectionName, idPrefix) {
    const start = idPrefix;
    const end = `${idPrefix}\uf8ff`;
    const snap = await db
        .collection(collectionName)
        .where(FieldPath.documentId(), ">=", start)
        .where(FieldPath.documentId(), "<=", end)
        .get();

    return snap.docs;
}

async function deleteDocs(docs) {
    if (dryRun || docs.length === 0) return;

    let batch = db.batch();
    let ops = 0;

    for (const doc of docs) {
        batch.delete(doc.ref);
        ops += 1;
        if (ops === 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }

    if (ops > 0) {
        await batch.commit();
    }
}

async function deleteStoragePrefix(storagePrefix) {
    if (dryRun || !withStorage) return;
    await bucket.deleteFiles({ prefix: storagePrefix });
}

async function main() {
    const lookbookIdPrefix = `${prefix}_lookbooks_`;
    const eventIdPrefix = `${prefix}_events_`;

    const [lookbookDocs, eventDocs] = await Promise.all([
        fetchDocsByPrefix("lookbooks", lookbookIdPrefix),
        fetchDocsByPrefix("events", eventIdPrefix),
    ]);

    const lookbookIds = lookbookDocs.map(doc => doc.id);
    const eventIds = eventDocs.map(doc => doc.id);

    await Promise.all([
        deleteDocs(lookbookDocs),
        deleteDocs(eventDocs),
    ]);

    if (withStorage) {
        await Promise.all([
            ...lookbookIds.map(id => deleteStoragePrefix(`lookbooks/${id}/`)),
            ...eventIds.map(id => deleteStoragePrefix(`events/${id}/`)),
        ]);
    }

    console.log(JSON.stringify({
        prefix,
        dryRun,
        withStorage,
        lookbooks: {
            deleted: lookbookIds.length,
            ids: lookbookIds,
        },
        events: {
            deleted: eventIds.length,
            ids: eventIds,
        },
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
