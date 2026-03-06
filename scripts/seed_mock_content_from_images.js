import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import ngeohash from "ngeohash";
import { Timestamp } from "firebase-admin/firestore";
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
const dryRun = args.has("--dry-run");
const skipUpload = args.has("--skip-upload");
const onlyLookbooks = args.has("--only-lookbooks");
const onlyEvents = args.has("--only-events");
const prefixArg = process.argv.find(v => v.startsWith("--prefix="));
const prefix = prefixArg ? prefixArg.split("=").slice(1).join("=") : `mvp1_mock_${Date.now()}`;

if (onlyLookbooks && onlyEvents) {
    console.error("Use either --only-lookbooks or --only-events, not both.");
    process.exit(1);
}

const rootDir = process.cwd();
const lookbooksDir = path.join(rootDir, "images", "lookbooks");
const eventsDir = path.join(rootDir, "images", "events");
const db = getFirestoreInstance();
const storage = getStorageInstance();
const bucket = storage.bucket();

const COUNTRY_PRESETS = [
    {
        country: "Ukraine",
        countryNormalized: "ukraine",
        city: "Kyiv",
        cityNormalized: "kyiv",
        lat: 50.4501,
        lng: 30.5234,
    },
    {
        country: "Italy",
        countryNormalized: "italy",
        city: "Milan",
        cityNormalized: "milan",
        lat: 45.4642,
        lng: 9.19,
    },
    {
        country: "France",
        countryNormalized: "france",
        city: "Paris",
        cityNormalized: "paris",
        lat: 48.8566,
        lng: 2.3522,
    },
];

const LOOKBOOK_TITLE_PRESETS = [
    "Street Layer",
    "Soft Volume",
    "Urban Capsule",
    "Cozy Contrast",
    "Neutral Tailoring",
    "Weekend Motion",
    "Evening Texture",
    "Casual Power",
    "Minimal Edit",
    "Monochrome Mood",
];

const EVENT_TITLE_PRESETS = [
    "Fashion Week",
    "Pretty Pastel Pop-Up Shop",
    "New Collection Preview",
    "Designer Talk Night",
    "Capsule Collection Launch",
    "Street Style Session",
    "Wardrobe Styling Workshop",
    "Local Brands Showcase",
    "Editorial Shooting Day",
    "Fashion Networking Meetup",
];

function isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext);
}

function compareByNumericSuffix(a, b) {
    const aNum = Number((a.match(/(\d+)/g) || []).pop() || Number.MAX_SAFE_INTEGER);
    const bNum = Number((b.match(/(\d+)/g) || []).pop() || Number.MAX_SAFE_INTEGER);
    if (aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
}

async function listImageFiles(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
        .filter(entry => entry.isFile() && isImageFile(entry.name))
        .map(entry => entry.name)
        .sort(compareByNumericSuffix);
}

async function uploadImage(localPath, destinationPath) {
    if (skipUpload || dryRun) return;
    await bucket.upload(localPath, {
        destination: destinationPath,
        metadata: { cacheControl: "public, max-age=3600" },
    });
}

function pickPreset(index) {
    return COUNTRY_PRESETS[index % COUNTRY_PRESETS.length];
}

function buildLookbookDoc({ id, filename, index }) {
    const preset = pickPreset(index);
    const nowMs = Date.now();
    const publishedAt = new Date(nowMs - index * 60 * 60 * 1000);
    const seasonKey = index % 2 === 0 ? "ss-2026" : "fw-2026";
    const seasonLabel = seasonKey === "ss-2026" ? "SS 2026" : "FW 2026";
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const coverPath = `lookbooks/${id}/cover/${safeName}`;
    const pagePath = `lookbooks/${id}/pages/1-${safeName}`;
    const title = LOOKBOOK_TITLE_PRESETS[index % LOOKBOOK_TITLE_PRESETS.length];

    return {
        id,
        doc: {
            title,
            name: title,
            description: `${title} editorial set for ${preset.city}.`,
            country: preset.country,
            countryNormalized: preset.countryNormalized,
            city: preset.city,
            cityNormalized: preset.cityNormalized,
            seasonLabel,
            seasonKey,
            sortRank: index < 4 ? index + 1 : null,
            coverPath,
            images: [
                { storagePath: pagePath, order: 1 },
            ],
            // Independent geo for nearby lookup in lookbooks list.
            geo: {
                country: preset.country,
                city: preset.city,
                cityNormalized: preset.cityNormalized,
                coords: {
                    lat: preset.lat,
                    lng: preset.lng,
                },
                geohash: ngeohash.encode(preset.lat, preset.lng, 7),
            },
            author: {
                name: "Svitlana",
                position: "Stylist",
                instagram: "https://instagram.com/svitlana_stylist",
            },
            items: [
                { name: "Coat", brand: "Bazhane", link: "https://example.com/item/coat" },
                { name: "Jeans", brand: "Coat", link: "https://example.com/item/jeans" },
                { name: "Bag", brand: "Kocharovska", link: "https://example.com/item/bag" },
            ],
            source: "seed",
            seedBatchPrefix: prefix,
            seedSource: "images",
            published: true,
            publishedAt: Timestamp.fromDate(publishedAt),
            createdAt: Timestamp.fromDate(new Date(nowMs - (index + 1) * 60 * 60 * 1000)),
            updatedAt: Timestamp.fromDate(new Date(nowMs - index * 30 * 60 * 1000)),
        },
        uploads: [
            { destinationPath: coverPath, suffix: "cover" },
            { destinationPath: pagePath, suffix: "page" },
        ],
    };
}

function buildEventDoc({ id, filename, index }) {
    const preset = pickPreset(index);
    const nowMs = Date.now();
    const startsAt = new Date(nowMs + (index + 2) * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const coverPath = `events/${id}/cover/${safeName}`;
    const title = EVENT_TITLE_PRESETS[index % EVENT_TITLE_PRESETS.length];

    return {
        id,
        doc: {
            name: title,
            description: `${title} in ${preset.city}.`,
            type: "fashion_week",
            country: preset.country,
            city: preset.city,
            cityNormalized: preset.cityNormalized,
            address: `${preset.city}, Main Fashion Street 1`,
            externalUrl: "https://example.com/fashion-event",
            coverPath,
            published: true,
            startsAt: Timestamp.fromDate(startsAt),
            endsAt: Timestamp.fromDate(endsAt),
            createdAt: Timestamp.fromDate(new Date(nowMs - (index + 1) * 60 * 60 * 1000)),
            updatedAt: Timestamp.fromDate(new Date(nowMs - index * 30 * 60 * 1000)),
            source: "seed",
            seedBatchPrefix: prefix,
            seedSource: "images",
        },
        uploads: [
            { destinationPath: coverPath, suffix: "cover" },
        ],
    };
}

async function upsertCollectionFromImages({ collectionName, dirPath, buildDoc }) {
    const files = await listImageFiles(dirPath);
    const result = [];

    for (let index = 0; index < files.length; index += 1) {
        const filename = files[index];
        const id = `${prefix}_${collectionName}_${index + 1}`;
        const localPath = path.join(dirPath, filename);
        const built = buildDoc({ id, filename, index });

        for (const upload of built.uploads) {
            await uploadImage(localPath, upload.destinationPath);
        }

        if (!dryRun) {
            await db.collection(collectionName).doc(id).set(built.doc, { merge: true });
        }

        result.push({ id, filename, country: built.doc.country, city: built.doc.city });
    }

    return { count: files.length, items: result };
}

async function main() {
    const summary = { prefix, dryRun, skipUpload, lookbooks: null, events: null };

    if (!onlyEvents) {
        summary.lookbooks = await upsertCollectionFromImages({
            collectionName: "lookbooks",
            dirPath: lookbooksDir,
            buildDoc: buildLookbookDoc,
        });
    }

    if (!onlyLookbooks) {
        summary.events = await upsertCollectionFromImages({
            collectionName: "events",
            dirPath: eventsDir,
            buildDoc: buildEventDoc,
        });
    }

    console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
