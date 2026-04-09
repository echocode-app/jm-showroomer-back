import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { getAuthInstance, getFirestoreInstance, getStorageInstance } from "../src/config/firebase.js";

const ENV = process.env.NODE_ENV || "dev";
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

try {
    await fs.access(envFile);
    dotenv.config({ path: envFile });
} catch {
    // allow runtime env only
}

const argv = process.argv.slice(2);
const args = new Set(argv);
const dryRun = !args.has("--execute");
const allowProd = args.has("--allow-prod");
const withStorage = args.has("--with-storage");
const withAuth = args.has("--with-auth");
const withAnalytics = args.has("--with-analytics");
const reassignRetainedOwnerTo = readArgValue(argv, "--reassign-retained-owner-to");

if (ENV === "prod" && !allowProd) {
    console.error("Refusing to run prod reset without --allow-prod");
    process.exit(1);
}

const PROTECTED_ADMIN_IDS = new Set([
    "79O7MF1ofWR7QChbOeiZjB04TCf1",
    "27CuLoJwngVgTwN0aNbnVAecYz22",
    "zuiJC9FpxRS4KOAzly4GUaNl3Wv2",
    "v5LBcPFhlBMxWOkfNfJJaVSvslf2",
    "pV5dpiWmr3bFMUccTjVZJd5VCoh1",
]);

const db = getFirestoreInstance();
const auth = getAuthInstance();
const storage = getStorageInstance();
const bucket = storage.bucket();

function logStep(message, extra = null) {
    const payload = extra ? ` ${JSON.stringify(extra)}` : "";
    console.log(`[launch-reset] ${message}${payload}`);
}

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
    if (dryRun || !withStorage || prefixes.length === 0) return 0;
    await Promise.all(prefixes.map(prefix => bucket.deleteFiles({ prefix })));
    return prefixes.length;
}

async function deleteAuthUsers(userIds) {
    if (dryRun || !withAuth || userIds.length === 0) {
        return { attempted: userIds.length, deleted: 0, notFound: 0, failed: [] };
    }

    let deleted = 0;
    let notFound = 0;
    const failed = [];

    for (const uid of userIds) {
        try {
            await auth.deleteUser(uid);
            deleted += 1;
        } catch (err) {
            const code = err?.code || "";
            if (code === "auth/user-not-found") {
                notFound += 1;
                continue;
            }
            failed.push({ uid, code: code || "unknown", message: err?.message || String(err) });
        }
    }

    return { attempted: userIds.length, deleted, notFound, failed };
}

function readArgValue(argv, flag) {
    const direct = argv.find(arg => arg.startsWith(`${flag}=`));
    if (direct) return direct.slice(flag.length + 1) || null;
    const idx = argv.indexOf(flag);
    if (idx < 0) return null;
    return argv[idx + 1] || null;
}

async function buildShowroomCleanupPlan() {
    logStep("scan showrooms:start");
    const topRefs = await listAllDocRefs(db.collection("showrooms"));
    logStep("scan showrooms:root_docs_loaded", { count: topRefs.length });

    if (dryRun) {
        return {
            ids: topRefs.map(ref => ref.id),
            refs: topRefs,
            storagePrefixes: topRefs.map(ref => `showrooms/${ref.id}/`),
        };
    }

    const allRefs = [];
    let processed = 0;
    for (const ref of topRefs) {
        const descendants = await collectDescendantRefs(ref, []);
        allRefs.push(...descendants, ref);
        processed += 1;
        if (processed % 25 === 0 || processed === topRefs.length) {
            logStep("scan showrooms:descendants_progress", { processed, total: topRefs.length });
        }
    }
    return {
        ids: topRefs.map(ref => ref.id),
        refs: allRefs,
        storagePrefixes: topRefs.map(ref => `showrooms/${ref.id}/`),
    };
}

async function collectRetainedContentOwnerIds() {
    logStep("scan retained_content_owners:start");
    const ownerIds = new Set();

    const [lookbooksSnap, eventsSnap] = await Promise.all([
        db.collection("lookbooks").get(),
        db.collection("events").get(),
    ]);
    logStep("scan retained_content_owners:collections_loaded", {
        lookbooks: lookbooksSnap.size,
        events: eventsSnap.size,
    });

    for (const doc of lookbooksSnap.docs) {
        const data = doc.data() || {};
        if (typeof data.authorId === "string" && data.authorId.trim()) {
            ownerIds.add(data.authorId.trim());
        }
        if (typeof data.ownerUid === "string" && data.ownerUid.trim()) {
            ownerIds.add(data.ownerUid.trim());
        }
    }

    for (const doc of eventsSnap.docs) {
        const data = doc.data() || {};
        if (typeof data.ownerUid === "string" && data.ownerUid.trim()) {
            ownerIds.add(data.ownerUid.trim());
        }
    }

    return ownerIds;
}

async function reassignRetainedContentOwners(targetUid) {
    if (!targetUid) {
        return { targetUid: null, migratedLookbooks: 0, migratedEvents: 0, ownerIds: [] };
    }

    const ownerIds = Array.from(await collectRetainedContentOwnerIds())
        .filter(id => !PROTECTED_ADMIN_IDS.has(id))
        .filter(id => id !== targetUid);

    if (ownerIds.length === 0) {
        return { targetUid, migratedLookbooks: 0, migratedEvents: 0, ownerIds: [] };
    }

    logStep("reassign retained_content_owners:start", { targetUid, ownerIds });

    let migratedLookbooks = 0;
    let migratedEvents = 0;

    for (const ownerUid of ownerIds) {
        const [authorSnap, legacySnap, eventsSnap] = await Promise.all([
            db.collection("lookbooks").where("authorId", "==", ownerUid).get(),
            db.collection("lookbooks").where("ownerUid", "==", ownerUid).get(),
            db.collection("events").where("ownerUid", "==", ownerUid).get(),
        ]);

        const lookbookRefs = new Map();
        [...authorSnap.docs, ...legacySnap.docs].forEach(doc => lookbookRefs.set(doc.ref.path, doc.ref));

        if (!dryRun) {
            let batch = db.batch();
            let writes = 0;

            for (const ref of lookbookRefs.values()) {
                batch.update(ref, {
                    authorId: targetUid,
                    ownerUid: targetUid,
                    updatedAt: new Date(),
                });
                writes += 1;
                if (writes >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    writes = 0;
                }
            }

            for (const doc of eventsSnap.docs) {
                batch.update(doc.ref, {
                    ownerUid: targetUid,
                    updatedAt: new Date(),
                });
                writes += 1;
                if (writes >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    writes = 0;
                }
            }

            if (writes > 0) {
                await batch.commit();
            }
        }

        migratedLookbooks += lookbookRefs.size;
        migratedEvents += eventsSnap.size;
    }

    logStep("reassign retained_content_owners:done", {
        targetUid,
        ownerIds,
        migratedLookbooks,
        migratedEvents,
    });

    return { targetUid, migratedLookbooks, migratedEvents, ownerIds };
}

async function buildUsersCleanupPlan() {
    logStep("scan users:start");
    const retainedContentOwnerIds = await collectRetainedContentOwnerIds();
    const protectedIds = new Set([...PROTECTED_ADMIN_IDS, ...retainedContentOwnerIds]);
    const snap = await db.collection("users").get();
    logStep("scan users:root_docs_loaded", {
        totalUsers: snap.size,
        protectedIds: protectedIds.size,
    });

    const topRefs = snap.docs
        .map(doc => doc.ref)
        .filter(ref => !protectedIds.has(ref.id));

    logStep("scan users:delete_candidates_loaded", { count: topRefs.length });

    if (dryRun) {
        return {
            ids: topRefs.map(ref => ref.id),
            refs: topRefs,
            protectedIds: Array.from(protectedIds),
            retainedContentOwnerIds: Array.from(retainedContentOwnerIds).filter(id => !PROTECTED_ADMIN_IDS.has(id)),
        };
    }

    const allRefs = [];
    let processed = 0;
    for (const ref of topRefs) {
        const descendants = await collectDescendantRefs(ref, []);
        allRefs.push(...descendants, ref);
        processed += 1;
        if (processed % 25 === 0 || processed === topRefs.length) {
            logStep("scan users:descendants_progress", { processed, total: topRefs.length });
        }
    }

    return {
        ids: topRefs.map(ref => ref.id),
        refs: allRefs,
        protectedIds: Array.from(protectedIds),
        retainedContentOwnerIds: Array.from(retainedContentOwnerIds).filter(id => !PROTECTED_ADMIN_IDS.has(id)),
    };
}

async function buildAnalyticsCleanupPlan() {
    logStep("scan analytics:start");
    const topRefs = await listAllDocRefs(db.collection("analytics_events"));
    logStep("scan analytics:root_docs_loaded", { count: topRefs.length });
    return {
        ids: topRefs.map(ref => ref.id),
        refs: topRefs,
    };
}

async function main() {
    logStep("start", {
        env: ENV,
        dryRun,
        withStorage,
        withAuth,
        withAnalytics,
        reassignRetainedOwnerTo,
    });
    if (dryRun && withStorage) {
        logStep("note", { message: "--with-storage is ignored during dry-run" });
    }
    if (dryRun && withAuth) {
        logStep("note", { message: "--with-auth is ignored during dry-run" });
    }

    if (reassignRetainedOwnerTo && !PROTECTED_ADMIN_IDS.has(reassignRetainedOwnerTo)) {
        throw new Error("--reassign-retained-owner-to must be one of protected admin UIDs");
    }

    const reassignment = await reassignRetainedContentOwners(reassignRetainedOwnerTo);

    const [showrooms, users, analytics] = await Promise.all([
        buildShowroomCleanupPlan(),
        buildUsersCleanupPlan(),
        withAnalytics ? buildAnalyticsCleanupPlan() : Promise.resolve({ ids: [], refs: [] }),
    ]);

    logStep("plan_ready", {
        showroomRootDocs: showrooms.ids.length,
        userRootDocs: users.ids.length,
        analyticsRootDocs: analytics.ids.length,
    });

    const [deletedShowroomRefs, deletedUserRefs, deletedAnalyticsRefs, deletedStoragePrefixes, authSummary] = await Promise.all([
        deleteRefs(showrooms.refs),
        deleteRefs(users.refs),
        deleteRefs(analytics.refs),
        deleteStoragePrefixes(showrooms.storagePrefixes),
        deleteAuthUsers(users.ids),
    ]);

    logStep("done");

    console.log(JSON.stringify({
        env: ENV,
        dryRun,
        withStorage,
        withAuth,
        withAnalytics,
        reassignment,
        protectedAdminIds: Array.from(PROTECTED_ADMIN_IDS),
        retainedContentOwnerIds: users.retainedContentOwnerIds,
        showrooms: {
            rootDocs: showrooms.ids.length,
            deletedRefs: deletedShowroomRefs,
            deletedStoragePrefixes,
            ids: showrooms.ids,
        },
        users: {
            rootDocs: users.ids.length,
            deletedRefs: deletedUserRefs,
            ids: users.ids,
        },
        analytics: {
            rootDocs: analytics.ids.length,
            deletedRefs: deletedAnalyticsRefs,
        },
        authUsers: authSummary,
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
