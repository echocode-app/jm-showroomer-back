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

const args = new Set(process.argv.slice(2));
const prefixArg = process.argv.find(value => value.startsWith("--prefix="));
const dryRun = !args.has("--execute");
const allowProd = args.has("--allow-prod");

if (ENV === "prod" && !allowProd) {
    console.error("Refusing to backfill prod without --allow-prod");
    process.exit(1);
}

const requiredPrefix = prefixArg ? prefixArg.split("=").slice(1).join("=") : null;
const db = getFirestoreInstance();

const BRAND_BY_ITEM_NAME = new Map([
    ["coat", "Bazhane"],
    ["jeans", "Coat"],
    ["belt", "Coat"],
    ["top", "Woolhappen"],
    ["t-shirt", "Woolhappen"],
    ["shirt", "Woolhappen"],
    ["bag", "Kocharovska"],
    ["shoes", "Kocharovska"],
]);

function normalizeName(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
}

function isMockLookbook(id, data) {
    if (!id) return false;
    if (data?.source === "seed") return true;
    if (typeof data?.seedSource === "string") return true;
    if (typeof data?.seedBatchPrefix === "string") return true;
    if (id.startsWith("mvp1_mock_")) return true;
    if (id.startsWith("lookbook_")) return true;
    return false;
}

function matchesPrefix(id, data, prefix) {
    if (!prefix) return true;
    if (id.startsWith(prefix)) return true;
    if (id.startsWith(`${prefix}_lookbooks_`)) return true;
    if (data?.seedBatchPrefix === prefix) return true;
    return false;
}

function backfillItems(items) {
    if (!Array.isArray(items)) return null;

    let changed = false;
    const nextItems = items.map(item => {
        if (!item || typeof item !== "object") return item;
        const currentBrand = typeof item.brand === "string" ? item.brand.trim() : "";
        if (currentBrand) return item;

        const inferredBrand = BRAND_BY_ITEM_NAME.get(normalizeName(item.name));
        if (!inferredBrand) return item;

        changed = true;
        return {
            ...item,
            brand: inferredBrand,
        };
    });

    return changed ? nextItems : null;
}

async function main() {
    const snap = await db.collection("lookbooks").get();
    const planned = [];

    snap.docs.forEach(doc => {
        const data = doc.data() || {};
        if (!isMockLookbook(doc.id, data)) return;
        if (!matchesPrefix(doc.id, data, requiredPrefix)) return;

        const nextItems = backfillItems(data.items);
        if (!nextItems) return;

        planned.push({
            ref: doc.ref,
            id: doc.id,
            items: nextItems,
        });
    });

    if (!dryRun && planned.length > 0) {
        for (let i = 0; i < planned.length; i += 400) {
            const chunk = planned.slice(i, i + 400);
            const batch = db.batch();
            chunk.forEach(item => {
                batch.update(item.ref, {
                    items: item.items,
                    updatedAt: new Date().toISOString(),
                });
            });
            await batch.commit();
        }
    }

    console.log(JSON.stringify({
        env: ENV,
        dryRun,
        prefix: requiredPrefix,
        matched: planned.length,
        sample: planned.slice(0, 20).map(item => ({
            id: item.id,
            items: item.items,
        })),
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
