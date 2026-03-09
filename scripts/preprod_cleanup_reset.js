import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
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
const dryRun = !args.has("--execute");
const withStorage = args.has("--with-storage");
const allowProd = args.has("--allow-prod");

if (ENV === "prod" && !allowProd) {
    console.error("Refusing to cleanup prod without --allow-prod");
    process.exit(1);
}

const db = getFirestoreInstance();
const storage = getStorageInstance();
const bucket = storage.bucket();

const PROTECTED_ADMIN_IDS = new Set([
    "79O7MF1ofWR7QChbOeiZjB04TCf1",
    "27CuLoJwngVgTwN0aNbnVAecYz22",
    "zuiJC9FpxRS4KOAzly4GUaNl3Wv2",
    "v5LBcPFhlBMxWOkfNfJJaVSvslf2",
]);

async function listAllDocRefs(collectionRef) {
    const snap = await collectionRef.get();
    return snap.docs.map(doc => doc.ref);
}

async function collectDescendantRefs(docRef, acc = []) {
    const subcollections = await docRef.listCollections();
    for (const subcollection of subcollections) {
        const subSnap = await subcollection.get();
        for (const doc of subSnap.docs) {
            await collectDescendantRefs(doc.ref, acc);
            acc.push(doc.ref);
        }
    }
    return acc;
}

async function deleteRefs(refs) {
    if (refs.length === 0) return 0;
    if (dryRun) return refs.length;

    let deleted = 0;
    for (let i = 0; i < refs.length; i += 400) {
        const chunk = refs.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
        deleted += chunk.length;
    }
    return deleted;
}

async function deleteStoragePrefixes(prefixes) {
    if (dryRun || !withStorage) return;
    await Promise.all(prefixes.map(prefix => bucket.deleteFiles({ prefix })));
}

async function buildShowroomCleanupPlan() {
    const topRefs = await listAllDocRefs(db.collection("showrooms"));
    const allRefs = [];
    for (const ref of topRefs) {
        const descendants = await collectDescendantRefs(ref, []);
        allRefs.push(...descendants, ref);
    }
    return {
        ids: topRefs.map(ref => ref.id),
        refs: allRefs,
        storagePrefixes: topRefs.map(ref => `showrooms/${ref.id}/`),
    };
}

async function buildTestUsersCleanupPlan() {
    const snap = await db.collection("users").where("role", "==", "test").get();
    const topRefs = snap.docs
        .map(doc => doc.ref)
        .filter(ref => !PROTECTED_ADMIN_IDS.has(ref.id));

    const allRefs = [];
    for (const ref of topRefs) {
        const descendants = await collectDescendantRefs(ref, []);
        allRefs.push(...descendants, ref);
    }
    return {
        ids: topRefs.map(ref => ref.id),
        refs: allRefs,
    };
}

async function buildAnalyticsCleanupPlan() {
    const topRefs = await listAllDocRefs(db.collection("analytics_events"));
    return {
        ids: topRefs.map(ref => ref.id),
        refs: topRefs,
    };
}

async function main() {
    const [showrooms, testUsers, analytics] = await Promise.all([
        buildShowroomCleanupPlan(),
        buildTestUsersCleanupPlan(),
        buildAnalyticsCleanupPlan(),
    ]);

    const [deletedShowroomRefs, deletedTestUserRefs, deletedAnalyticsRefs] = await Promise.all([
        deleteRefs(showrooms.refs),
        deleteRefs(testUsers.refs),
        deleteRefs(analytics.refs),
    ]);

    await deleteStoragePrefixes(showrooms.storagePrefixes);

    console.log(JSON.stringify({
        env: ENV,
        dryRun,
        withStorage,
        protectedAdminIds: Array.from(PROTECTED_ADMIN_IDS),
        showrooms: {
            rootDocs: showrooms.ids.length,
            deletedRefs: deletedShowroomRefs,
            ids: showrooms.ids,
        },
        testUsers: {
            rootDocs: testUsers.ids.length,
            deletedRefs: deletedTestUserRefs,
            ids: testUsers.ids,
        },
        analytics: {
            rootDocs: analytics.ids.length,
            deletedRefs: deletedAnalyticsRefs,
            ids: analytics.ids.slice(0, 100),
            omittedCount: Math.max(0, analytics.ids.length - 100),
        },
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
