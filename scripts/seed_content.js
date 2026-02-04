import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { getFirestoreInstance, getStorageInstance } from "../src/config/firebase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const reset = args.has("--reset");

const ENV = process.env.NODE_ENV || "dev";
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

try {
    await fs.access(envFile);
    dotenv.config({ path: envFile });
} catch {
    // allow running without env file (assumes env vars already set)
}

if (reset && ENV === "prod") {
    console.error("❌ --reset is not allowed in production");
    process.exit(1);
}

const storage = getStorageInstance();
const bucket = storage.bucket();
const db = getFirestoreInstance();

async function listDirs(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
        return [];
    }
}

async function listFiles(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.filter(e => e.isFile()).map(e => e.name);
    } catch {
        return [];
    }
}

async function uploadIfNeeded(localPath, destPath) {
    if (dryRun) {
        console.log(`DRY RUN upload: ${localPath} -> ${destPath}`);
        return;
    }

    const file = bucket.file(destPath);
    const [exists] = await file.exists();
    if (exists) return;

    await bucket.upload(localPath, {
        destination: destPath,
        metadata: {
            cacheControl: "public, max-age=3600",
        },
    });
}

async function deletePrefix(prefix) {
    if (dryRun) {
        console.log(`DRY RUN delete prefix: ${prefix}`);
        return;
    }
    await bucket.deleteFiles({ prefix });
}

async function readMeta(metaPath) {
    try {
        const raw = await fs.readFile(metaPath, "utf8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

async function seedLookbooks() {
    const baseDir = path.join(__dirname, "seed_assets", "lookbooks");
    const ids = await listDirs(baseDir);

    if (ids.length === 0) {
        console.log("No lookbook seed folders found.");
        return;
    }

    for (const id of ids) {
        const dir = path.join(baseDir, id);
        const meta = await readMeta(path.join(dir, "meta.json"));

        const rootFiles = await listFiles(dir);
        let coverFile = rootFiles.find(f => /^cover\./i.test(f) || /^cover_/i.test(f));
        let coverFilePath = coverFile ? path.join(dir, coverFile) : null;

        const coverDir = path.join(dir, "cover");
        const coverDirFiles = await listFiles(coverDir);
        if (!coverFile && coverDirFiles.length > 0) {
            coverFile = coverDirFiles[0];
            coverFilePath = path.join(coverDir, coverFile);
        }

        const pagesDir = path.join(dir, "pages");
        const assetsDir = path.join(dir, "assets");
        const pagesFiles = await listFiles(pagesDir);
        const assetsFiles = await listFiles(assetsDir);
        const assetFiles = (pagesFiles.length ? pagesFiles.map(f => path.join(pagesDir, f)) : assetsFiles.map(f => path.join(assetsDir, f)))
            .sort();

        const coverPath = coverFile
            ? `lookbooks/${id}/cover/${path.basename(coverFile)}`
            : null;

        const assets = assetFiles.map((filePath, index) => ({
            path: `lookbooks/${id}/pages/${path.basename(filePath)}`,
            type: "image",
            order: index + 1,
        }));

        if (reset) {
            console.log(`Resetting lookbook ${id}`);
            await deletePrefix(`lookbooks/${id}/`);
            if (!dryRun) {
                await db.collection("lookbooks").doc(id).delete();
            }
        }

        if (coverFile && coverFilePath) {
            await uploadIfNeeded(coverFilePath, coverPath);
        }

        for (const asset of assets) {
            const localPath = assetFiles[asset.order - 1];
            await uploadIfNeeded(localPath, asset.path);
        }

        const ref = db.collection("lookbooks").doc(id);
        const snap = await ref.get();
        const now = new Date().toISOString();

        const data = {
            name: meta.name || id,
            description: meta.description || null,
            coverPath,
            assets,
            source: "seed",
            published: true,
            createdBy: null,
            ownerUid: null,
            seedKey: id,
            createdAt: snap.exists ? snap.data().createdAt ?? now : now,
            updatedAt: now,
        };

        if (dryRun) {
            console.log(`DRY RUN upsert lookbook ${id}`, data);
        } else {
            await ref.set(data, { merge: true });
            console.log(`Seeded lookbook ${id}`);
        }
    }
}

async function seedEvents() {
    const baseDir = path.join(__dirname, "seed_assets", "events");
    const ids = await listDirs(baseDir);

    if (ids.length === 0) {
        console.log("No event seed folders found.");
        return;
    }

    for (const id of ids) {
        const dir = path.join(baseDir, id);
        const meta = await readMeta(path.join(dir, "meta.json"));

        const rootFiles = await listFiles(dir);
        let coverFile = rootFiles.find(f => /^cover\./i.test(f) || /^cover_/i.test(f));
        let coverFilePath = coverFile ? path.join(dir, coverFile) : null;

        const coverDir = path.join(dir, "cover");
        const coverDirFiles = await listFiles(coverDir);
        if (!coverFile && coverDirFiles.length > 0) {
            coverFile = coverDirFiles[0];
            coverFilePath = path.join(coverDir, coverFile);
        }

        const assetsDir = path.join(dir, "assets");
        const assetsFiles = await listFiles(assetsDir);
        const assetFiles = assetsFiles.map(f => path.join(assetsDir, f)).sort();

        const coverPath = coverFile
            ? `events/${id}/cover/${path.basename(coverFile)}`
            : null;

        const assets = assetFiles.map((filePath, index) => ({
            path: `events/${id}/assets/${path.basename(filePath)}`,
            type: "image",
            order: index + 1,
        }));

        if (reset) {
            console.log(`Resetting event ${id}`);
            await deletePrefix(`events/${id}/`);
            if (!dryRun) {
                await db.collection("events").doc(id).delete();
            }
        }

        if (coverFile && coverFilePath) {
            await uploadIfNeeded(coverFilePath, coverPath);
        }

        for (const asset of assets) {
            const localPath = assetFiles[asset.order - 1];
            await uploadIfNeeded(localPath, asset.path);
        }

        const ref = db.collection("events").doc(id);
        const snap = await ref.get();
        const now = new Date().toISOString();

        const data = {
            name: meta.name || id,
            description: meta.description || null,
            coverPath,
            assets,
            source: "seed",
            published: true,
            createdBy: null,
            owner: null,
            seedKey: id,
            createdAt: snap.exists ? snap.data().createdAt ?? now : now,
            updatedAt: now,
        };

        if (dryRun) {
            console.log(`DRY RUN upsert event ${id}`, data);
        } else {
            await ref.set(data, { merge: true });
            console.log(`Seeded event ${id}`);
        }
    }
}

async function main() {
    console.log(`Seeding content (env=${ENV}, dryRun=${dryRun}, reset=${reset})`);
    await seedLookbooks();
    await seedEvents();
    console.log("Done.");
}

main().catch(err => {
    console.error("❌ Seed failed", err);
    process.exit(1);
});
