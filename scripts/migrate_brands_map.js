// Backfill brandsMap for existing showrooms.
// Usage:
//   NODE_ENV=prod CONFIRM_BRANDS_MAP_MIGRATION=YES node scripts/migrate_brands_map.js

import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { buildBrandsMap, normalizeKey } from "../src/utils/showroomNormalization.js";

const ENV = process.env.NODE_ENV || "dev";
if (ENV === "prod" && process.env.CONFIRM_BRANDS_MAP_MIGRATION !== "YES") {
    console.error("Refusing to run in prod without CONFIRM_BRANDS_MAP_MIGRATION=YES.");
    process.exit(1);
}

const BATCH_LIMIT = 300;

function buildMapFromDoc(doc) {
    if (Array.isArray(doc.brands) && doc.brands.length > 0) {
        return buildBrandsMap(doc.brands);
    }
    if (Array.isArray(doc.brandsNormalized) && doc.brandsNormalized.length > 0) {
        const map = {};
        doc.brandsNormalized
            .map(value => normalizeKey(value))
            .filter(Boolean)
            .forEach(key => {
                map[key] = true;
            });
        return map;
    }
    return {};
}

async function main() {
    initFirebase();
    const db = getFirestoreInstance();
    let processed = 0;

    while (true) {
        const snapshot = await db
            .collection("showrooms")
            .where("brandsMap", "==", null)
            .limit(BATCH_LIMIT)
            .get();

        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const brandsMap = buildMapFromDoc(data);
            batch.update(doc.ref, { brandsMap });
        });
        await batch.commit();
        processed += snapshot.size;
    }

    console.log(`Backfilled brandsMap for ${processed} showrooms.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
