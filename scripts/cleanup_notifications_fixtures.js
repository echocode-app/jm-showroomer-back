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
const dryRun = !args.has("--execute");
const allowProd = args.has("--allow-prod");

if (ENV === "prod" && !allowProd) {
    console.error("Refusing to cleanup in prod without --allow-prod");
    process.exit(1);
}

const db = getFirestoreInstance();

async function fetchEventsNotifDocs() {
    return db
        .collection("events")
        .where(FieldPath.documentId(), ">=", "events_notif_")
        .where(FieldPath.documentId(), "<=", "events_notif_\uf8ff")
        .get();
}

async function fetchNotificationsLookbooks() {
    return db
        .collection("lookbooks")
        .where("description", "==", "Notifications lookbook")
        .get();
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

async function main() {
    const [eventSnap, lookbookSnap] = await Promise.all([
        fetchEventsNotifDocs(),
        fetchNotificationsLookbooks(),
    ]);

    const eventRefs = eventSnap.docs.map(doc => doc.ref);
    const lookbookRefs = lookbookSnap.docs
        .filter(doc => (doc.data()?.imageUrl || "") === "https://example.com/notifications-lookbook.jpg")
        .map(doc => doc.ref);

    const result = {
        env: ENV,
        dryRun,
        events: {
            count: eventRefs.length,
            ids: eventRefs.map(ref => ref.id),
        },
        lookbooks: {
            count: lookbookRefs.length,
            ids: lookbookRefs.map(ref => ref.id),
        },
    };

    await Promise.all([
        deleteRefs(eventRefs),
        deleteRefs(lookbookRefs),
    ]);

    console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
