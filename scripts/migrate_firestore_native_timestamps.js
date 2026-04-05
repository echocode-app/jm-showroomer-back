import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { toTimestamp } from "../src/utils/timestamp.js";

const ENV = process.env.NODE_ENV || "dev";
const execute = process.argv.includes("--execute");
const BATCH_SIZE = 200;

const COLLECTIONS = [
    {
        name: "users",
        fields: [
            "createdAt",
            "updatedAt",
            "deletedAt",
            "deleteLockAt",
            "roleRequest.requestedAt",
            "roleRequest.reviewedAt",
        ],
    },
    {
        name: "showrooms",
        fields: [
            "createdAt",
            "updatedAt",
            "submittedAt",
            "reviewedAt",
            "deletedAt",
        ],
    },
];

function getNestedValue(source, path) {
    return path.split(".").reduce((value, key) => value?.[key], source);
}

function buildTimestampPatch(doc, fields) {
    const patch = {};

    for (const field of fields) {
        const value = getNestedValue(doc, field);
        if (typeof value !== "string") continue;

        const timestamp = toTimestamp(value);
        if (!timestamp) continue;
        patch[field] = timestamp.toDate();
    }

    return patch;
}

async function migrateCollection(db, collectionConfig) {
    const summary = {
        scanned: 0,
        updated: 0,
        patchedFields: 0,
    };

    const collectionRef = db.collection(collectionConfig.name);
    let lastDoc = null;

    for (;;) {
        let query = collectionRef.orderBy("__name__").limit(BATCH_SIZE);
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            return summary;
        }

        let batch = db.batch();
        let batchWrites = 0;

        for (const docSnap of snapshot.docs) {
            summary.scanned += 1;
            const doc = docSnap.data() || {};
            const patch = buildTimestampPatch(doc, collectionConfig.fields);
            const patchKeys = Object.keys(patch);

            if (patchKeys.length === 0) continue;

            summary.updated += 1;
            summary.patchedFields += patchKeys.length;

            if (execute) {
                batch.update(docSnap.ref, patch);
                batchWrites += 1;

                if (batchWrites === BATCH_SIZE) {
                    await batch.commit();
                    batch = db.batch();
                    batchWrites = 0;
                }
            }
        }

        if (execute && batchWrites > 0) {
            await batch.commit();
        }

        if (snapshot.docs.length < BATCH_SIZE) {
            return summary;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
}

async function main() {
    initFirebase();
    const db = getFirestoreInstance();

    const results = {};
    for (const collectionConfig of COLLECTIONS) {
        results[collectionConfig.name] = await migrateCollection(db, collectionConfig);
    }

    console.log(JSON.stringify({
        env: ENV,
        execute,
        collections: results,
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err?.message || err);
    process.exit(1);
});
