import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { FieldPath } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../src/config/firebase.js";

const ENV = process.env.NODE_ENV || "dev";
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

try {
    await fs.access(envFile);
    dotenv.config({ path: envFile });
} catch {
    // allow runtime env only
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const allowProd = args.has("--allow-prod");

if (ENV === "prod" && !allowProd) {
    console.error("❌ Refusing to cleanup in prod without --allow-prod");
    process.exit(1);
}

const db = getFirestoreInstance();

const ID_PREFIXES = [
    "events_mvp1_",
    "events_guest_sync_",
    "lookbooks_mvp1_",
    "evt_",
];

const EXACT_LOOKBOOK_IDS = [
    "order-zero",
    "invalid-media-test-dotdot",
    "invalid-media-test-http",
    "invalid-media-test-backslash",
];

let deleted = {
    events: 0,
    lookbooks: 0,
    userLookbookFavorites: 0,
    userEventsWant: 0,
    userEventsDismissed: 0,
};

async function main() {
    console.log(`Cleanup test data (env=${ENV}, dryRun=${dryRun})`);

    deleted.events += await deleteByPrefixes("events", ID_PREFIXES);
    deleted.lookbooks += await deleteByPrefixes("lookbooks", ID_PREFIXES);
    deleted.lookbooks += await deleteExactIds("lookbooks", EXACT_LOOKBOOK_IDS);

    deleted.userLookbookFavorites += await deleteCollectionGroupByDocIdPrefixes(
        "lookbooks_favorites",
        ID_PREFIXES.concat(EXACT_LOOKBOOK_IDS)
    );

    deleted.userEventsWant += await deleteCollectionGroupByDocIdPrefixes(
        "events_want_to_visit",
        ID_PREFIXES
    );

    deleted.userEventsDismissed += await deleteCollectionGroupByDocIdPrefixes(
        "events_dismissed",
        ID_PREFIXES
    );

    console.log("Done.");
    console.log(JSON.stringify(deleted, null, 2));
}

async function deleteByPrefixes(collectionName, prefixes) {
    let count = 0;

    for (const prefix of prefixes) {
        const snap = await db
            .collection(collectionName)
            .where(FieldPath.documentId(), ">=", prefix)
            .where(FieldPath.documentId(), "<=", `${prefix}\uf8ff`)
            .get();

        count += await deleteRefsInBatches(snap.docs.map(doc => doc.ref));
    }

    return count;
}

async function deleteExactIds(collectionName, ids) {
    const refs = ids.map(id => db.collection(collectionName).doc(id));
    const snaps = await db.getAll(...refs);
    const existingRefs = snaps.filter(s => s.exists).map(s => s.ref);
    return deleteRefsInBatches(existingRefs);
}

async function deleteCollectionGroupByDocIdPrefixes(groupName, prefixesOrIds) {
    const snap = await db.collectionGroup(groupName).get();

    const refs = snap.docs
        .filter(doc => prefixesOrIds.some(prefix => doc.id.startsWith(prefix) || doc.id === prefix))
        .map(doc => doc.ref);

    return deleteRefsInBatches(refs);
}

async function deleteRefsInBatches(refs) {
    if (refs.length === 0) return 0;
    if (dryRun) return refs.length;

    let count = 0;
    for (let i = 0; i < refs.length; i += 400) {
        const chunk = refs.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
        count += chunk.length;
    }

    return count;
}

await main();
