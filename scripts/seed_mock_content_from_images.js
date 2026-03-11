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
const lookbookCountArg = process.argv.find(v => v.startsWith("--lookbook-count="));
const prefix = prefixArg ? prefixArg.split("=").slice(1).join("=") : `mvp1_mock_${Date.now()}`;
const lookbookCount = lookbookCountArg
    ? Number(lookbookCountArg.split("=").slice(1).join("="))
    : null;

if (onlyLookbooks && onlyEvents) {
    console.error("Use either --only-lookbooks or --only-events, not both.");
    process.exit(1);
}

if (lookbookCount !== null && (!Number.isInteger(lookbookCount) || lookbookCount < 1 || lookbookCount > 200)) {
    console.error("--lookbook-count must be an integer between 1 and 200.");
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
    {
        country: "Spain",
        countryNormalized: "spain",
        city: "Barcelona",
        cityNormalized: "barcelona",
        lat: 41.3851,
        lng: 2.1734,
    },
    {
        country: "Germany",
        countryNormalized: "germany",
        city: "Berlin",
        cityNormalized: "berlin",
        lat: 52.52,
        lng: 13.405,
    },
    {
        country: "Portugal",
        countryNormalized: "portugal",
        city: "Lisbon",
        cityNormalized: "lisbon",
        lat: 38.7223,
        lng: -9.1393,
    },
    {
        country: "Poland",
        countryNormalized: "poland",
        city: "Warsaw",
        cityNormalized: "warsaw",
        lat: 52.2297,
        lng: 21.0122,
    },
];

const LOOKBOOK_VARIANTS = [
    { title: "Street Layer", seasonKey: "summer", seasonLabel: "Summer" },
    { title: "Soft Volume", seasonKey: "winter", seasonLabel: "Winter" },
    { title: "Urban Capsule", seasonKey: "spring", seasonLabel: "Spring" },
    { title: "Cozy Contrast", seasonKey: "autumn", seasonLabel: "Autumn" },
    { title: "Neutral Tailoring", seasonKey: "autumn-winter", seasonLabel: "Autumn-Winter" },
    { title: "Weekend Motion", seasonKey: "spring-summer", seasonLabel: "Spring-Summer" },
    { title: "Evening Texture", seasonKey: "demi-season", seasonLabel: "Demi-season" },
    { title: "Casual Power", seasonKey: "pre-fall", seasonLabel: "Pre-Fall" },
    { title: "Minimal Edit", seasonKey: "resort", seasonLabel: "Resort" },
    { title: "Monochrome Mood", seasonKey: "winter", seasonLabel: "Winter" },
    { title: "A", seasonKey: "spring", seasonLabel: "Spring" },
    { title: "After the Last Tram Leaves the City", seasonKey: "autumn", seasonLabel: "Autumn" },
    { title: "Quiet Utility for Loud Days", seasonKey: "summer", seasonLabel: "Summer" },
    { title: "Officecore, But Make It Tender", seasonKey: "spring-summer", seasonLabel: "Spring-Summer" },
    { title: "Velvet Static", seasonKey: "autumn-winter", seasonLabel: "Autumn-Winter" },
    { title: "Noon in Milan, 14:37", seasonKey: "summer", seasonLabel: "Summer" },
    { title: "A Little Too Sharp for Sunday", seasonKey: "pre-fall", seasonLabel: "Pre-Fall" },
    { title: "Barely Formal", seasonKey: "demi-season", seasonLabel: "Demi-season" },
    { title: "The Coat Was the Whole Plan", seasonKey: "winter", seasonLabel: "Winter" },
    { title: "Postcards From a Grey Morning", seasonKey: "autumn", seasonLabel: "Autumn" },
    { title: "Layer 03", seasonKey: "spring", seasonLabel: "Spring" },
    { title: "Almost Minimal, Actually Not", seasonKey: "resort", seasonLabel: "Resort" },
    { title: "City Proof / Soft Proof", seasonKey: "demi-season", seasonLabel: "Demi-season" },
    { title: "The Longest Coffee Run in Paris", seasonKey: "spring-summer", seasonLabel: "Spring-Summer" },
    { title: "Soft Armor", seasonKey: "autumn-winter", seasonLabel: "Autumn-Winter" },
    { title: "One White Shirt and a Bad Intention", seasonKey: "spring", seasonLabel: "Spring" },
    { title: "Late Checkout Look", seasonKey: "resort", seasonLabel: "Resort" },
    { title: "Transit Romance", seasonKey: "autumn", seasonLabel: "Autumn" },
    { title: "Workwear for People Who Hate Workwear", seasonKey: "pre-fall", seasonLabel: "Pre-Fall" },
    { title: "Night Bus Elegance", seasonKey: "winter", seasonLabel: "Winter" },
];

const LOOKBOOK_AUTHOR_PRESETS = [
    { name: "Svitlana", position: "Stylist", instagram: "https://instagram.com/svitlana_stylist" },
    { name: "Marta", position: "Fashion Editor", instagram: "https://instagram.com/marta.edit" },
    { name: "Iryna", position: "Creative Producer", instagram: "https://instagram.com/iryna.producer" },
    { name: "Lina", position: "Image Maker", instagram: "https://instagram.com/lina.image" },
    { name: "Daria", position: "Personal Stylist", instagram: "https://instagram.com/daria.style.notes" },
];

const LOOKBOOK_ITEMS_PRESETS = [
    [
        { name: "Coat", brand: "Bazhane", link: "https://example.com/item/coat" },
        { name: "Jeans", brand: "Coat", link: "https://example.com/item/jeans" },
        { name: "Bag", brand: "Kocharovska", link: "https://example.com/item/bag" },
    ],
    [
        { name: "Blazer", brand: "The Coat", link: "https://example.com/item/blazer" },
        { name: "Trousers", brand: "Bazhane", link: "https://example.com/item/trousers" },
        { name: "Shoes", brand: "Kocharovska", link: "https://example.com/item/shoes" },
    ],
    [
        { name: "Top", brand: "Woolhappen", link: "https://example.com/item/top" },
        { name: "Skirt", brand: "Coat", link: "https://example.com/item/skirt" },
        { name: "Bag", brand: "Kocharovska", link: "https://example.com/item/bag-2" },
    ],
    [
        { name: "Shirt", brand: "The Coat", link: "https://example.com/item/shirt" },
        { name: "Belt", brand: "Coat", link: "https://example.com/item/belt" },
        { name: "Boots", brand: "Kocharovska", link: "https://example.com/item/boots" },
    ],
    [
        { name: "Dress", brand: "Bazhane", link: "https://example.com/item/dress" },
        { name: "Cardigan", brand: "Woolhappen", link: "https://example.com/item/cardigan" },
        { name: "Shoes", brand: "Kocharovska", link: "https://example.com/item/shoes-2" },
    ],
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
    const variant = LOOKBOOK_VARIANTS[index % LOOKBOOK_VARIANTS.length];
    const author = LOOKBOOK_AUTHOR_PRESETS[index % LOOKBOOK_AUTHOR_PRESETS.length];
    const items = LOOKBOOK_ITEMS_PRESETS[index % LOOKBOOK_ITEMS_PRESETS.length];
    const nowMs = Date.now();
    const publishedAt = new Date(nowMs - index * 60 * 60 * 1000);
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const coverPath = `lookbooks/${id}/cover/${safeName}`;
    const pagePath = `lookbooks/${id}/pages/1-${safeName}`;
    const title = variant.title;

    return {
        id,
        doc: {
            title,
            name: title,
            description: `${title} editorial set for ${preset.city}. Built for filter and layout coverage.`,
            country: preset.country,
            countryNormalized: preset.countryNormalized,
            city: preset.city,
            cityNormalized: preset.cityNormalized,
            seasonLabel: variant.seasonLabel,
            seasonKey: variant.seasonKey,
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
            author,
            items,
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
    const targetCount = collectionName === "lookbooks" && lookbookCount !== null
        ? lookbookCount
        : files.length;
    const result = [];

    for (let index = 0; index < targetCount; index += 1) {
        const filename = files[index % files.length];
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

    return { count: targetCount, sourceImages: files.length, items: result };
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
