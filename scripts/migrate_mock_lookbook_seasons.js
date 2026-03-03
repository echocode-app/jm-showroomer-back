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
const dryRun = args.has("--dry-run");
const prefixArg = process.argv.find(v => v.startsWith("--prefix="));
const prefix = prefixArg ? prefixArg.split("=").slice(1).join("=") : null;

const db = getFirestoreInstance();

const SEASON_KEY_MAP = new Map([
    ["spring", "spring"],
    ["summer", "summer"],
    ["autumn", "autumn"],
    ["fall", "autumn"],
    ["winter", "winter"],
    ["ss", "summer"],
    ["ss-2026", "summer"],
    ["ss-2025", "summer"],
    ["spring-summer", "summer"],
    ["spring_summer", "summer"],
    ["fw", "winter"],
    ["fw-2026", "winter"],
    ["fw-2025", "winter"],
    ["aw", "winter"],
    ["aw-2026", "winter"],
    ["autumn-winter", "winter"],
    ["autumn_winter", "winter"],
    ["fall-winter", "winter"],
    ["fall_winter", "winter"],
]);

const SEASON_LABEL_MAP = {
    spring: "Spring",
    summer: "Summer",
    autumn: "Autumn",
    winter: "Winter",
};

function normalizeKey(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
}

function mapSeasonKey(value) {
    const normalized = normalizeKey(value);
    if (!normalized) return null;
    return SEASON_KEY_MAP.get(normalized) || null;
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

function matchesPrefix(id, data, requiredPrefix) {
    if (!requiredPrefix) return true;
    if (id.startsWith(requiredPrefix)) return true;
    if (id.startsWith(`${requiredPrefix}_lookbooks_`)) return true;
    if (data?.seedBatchPrefix === requiredPrefix) return true;
    return false;
}

async function main() {
    const snap = await db.collection("lookbooks").get();
    const docs = snap.docs || [];
    const planned = [];

    for (const doc of docs) {
        const id = doc.id;
        const data = doc.data() || {};
        if (!isMockLookbook(id, data)) continue;
        if (!matchesPrefix(id, data, prefix)) continue;

        const currentKey = normalizeKey(data.seasonKey);
        const mappedKey = mapSeasonKey(data.seasonKey);
        if (!mappedKey) continue;
        if (currentKey === mappedKey && data.seasonLabel === SEASON_LABEL_MAP[mappedKey]) {
            continue;
        }

        planned.push({
            id,
            fromSeasonKey: data.seasonKey ?? null,
            toSeasonKey: mappedKey,
            fromSeasonLabel: data.seasonLabel ?? null,
            toSeasonLabel: SEASON_LABEL_MAP[mappedKey],
        });
    }

    if (!dryRun && planned.length > 0) {
        let batch = db.batch();
        let ops = 0;

        for (const item of planned) {
            const ref = db.collection("lookbooks").doc(item.id);
            batch.update(ref, {
                seasonKey: item.toSeasonKey,
                seasonLabel: item.toSeasonLabel,
                updatedAt: new Date().toISOString(),
            });
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

    console.log(JSON.stringify({
        env: ENV,
        dryRun,
        prefix: prefix || null,
        scanned: docs.length,
        matched: planned.length,
        updated: dryRun ? 0 : planned.length,
        items: planned.slice(0, 100),
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
