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
const prefixArg = process.argv.find(value => value.startsWith("--keep-prefix="));
const dryRun = !args.has("--execute");
const withStorage = args.has("--with-storage");
const allowProd = args.has("--allow-prod");

if (!prefixArg) {
    console.error("Missing required argument: --keep-prefix=<lookbook-id-prefix>");
    process.exit(1);
}

if (ENV === "prod" && !allowProd) {
    console.error("Refusing to update prod without --allow-prod");
    process.exit(1);
}

const keepPrefix = prefixArg.split("=").slice(1).join("=");
if (!keepPrefix || !keepPrefix.trim()) {
    console.error("Empty keep prefix.");
    process.exit(1);
}

const db = getFirestoreInstance();
const storage = getStorageInstance();
const bucket = storage.bucket();

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
    const snap = await db.collection("lookbooks").get();
    const allDocs = snap.docs;

    const keepDocs = allDocs.filter(doc => doc.id.startsWith(keepPrefix));
    const deleteDocsList = allDocs.filter(doc => !doc.id.startsWith(keepPrefix));

    await deleteDocs(deleteDocsList);

    if (withStorage) {
        await Promise.all(
            deleteDocsList.map(doc => deleteStoragePrefix(`lookbooks/${doc.id}/`))
        );
    }

    console.log(JSON.stringify({
        env: ENV,
        dryRun,
        withStorage,
        keepPrefix,
        keep: {
            count: keepDocs.length,
            ids: keepDocs.map(doc => doc.id),
        },
        deleted: {
            count: deleteDocsList.length,
            ids: deleteDocsList.map(doc => doc.id),
        },
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
