// Seed deterministic approved showroom fixtures for map/counters QA in production.
// Usage:
//   NODE_ENV=prod CONFIRM_PROD_SEED=YES node scripts/seed_map_qa_showrooms_prod.js

import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import {
    normalizeShowroomName,
    normalizeBrands,
    normalizeAddress,
    buildBrandsMap,
    normalizeSubcategories,
    normalizeInstagramUrl,
} from "../src/utils/showroomNormalization.js";
import { buildGeo } from "../src/utils/geoValidation.js";

const ENV = process.env.NODE_ENV || "dev";
if (ENV !== "prod") {
    console.error("Refusing to run: NODE_ENV must be 'prod'.");
    process.exit(1);
}
if (process.env.CONFIRM_PROD_SEED !== "YES") {
    console.error("Refusing to run in prod without CONFIRM_PROD_SEED=YES.");
    process.exit(1);
}

const SEED_BATCH = "map-qa-v1-20260323";
const ADMIN_ACTOR = { uid: "system", role: "admin" };

const OWNER_PLANS = [
    {
        uid: "5Q4vuh41ynN0EPeqVBaTAkAvmpB2",
        country: "Ukraine",
    },
    {
        uid: "JrI0yUQcEcf6HhalcGIGTKYPN4f2",
        country: "Ukraine",
    },
    {
        uid: "KY3vRhLtvDfwX7ijXADVjKCjqpH2",
        country: "Ukraine",
    },
    {
        uid: "eQ9vG8jvlCaz1VWyYRbzf5EHsNf2",
        country: "Czechia",
    },
    {
        uid: "fCKueXcEqNe3X0Z2TbILsSKq4j83",
        country: "Italy",
    },
    {
        uid: "d6hCpzS0DxgTUjjodu0Ag8FhO5A2",
        country: "Afghanistan",
    },
];

const BRAND_SETS = [
    ["Atelier North", "Quiet Form"],
    ["Borderline Studio", "Loom Edit"],
    ["Linear House", "Mila Edit"],
    ["Crafted Room", "Vivid Layer"],
    ["Foundry Wear", "Salt Wardrobe"],
];

const CATEGORY_GROUPS = ["clothing", "accessories", "footwear"];
const CATEGORIES = ["womenswear", "menswear", "accessories"];
const SUBCATEGORIES = [
    "outerwear",
    "dresses",
    "suits",
    "knitwear",
    "footwear",
    "bags",
    "jewelry",
];

const COUNTRY_PLANS = {
    Ukraine: {
        phonePrefix: "+38067",
        cities: [
            { city: "Cherkasy", lat: 49.4444, lng: 32.0598, count: 5, spread: 0.0075 },
            { city: "Lviv", lat: 49.8397, lng: 24.0297, count: 8, spread: 0.009 },
            { city: "Kyiv", lat: 50.4501, lng: 30.5234, count: 7, spread: 0.0105 },
        ],
    },
    Czechia: {
        phonePrefix: "+420603",
        cities: [
            { city: "Prague", lat: 50.0755, lng: 14.4378, count: 8, spread: 0.0105 },
            { city: "Brno", lat: 49.1951, lng: 16.6068, count: 6, spread: 0.009 },
            { city: "Ostrava", lat: 49.8209, lng: 18.2625, count: 3, spread: 0.008 },
            { city: "Plzen", lat: 49.7384, lng: 13.3736, count: 3, spread: 0.0075 },
        ],
    },
    Italy: {
        phonePrefix: "+39331",
        cities: [
            { city: "Milan", lat: 45.4642, lng: 9.19, count: 8, spread: 0.0105 },
            { city: "Rome", lat: 41.9028, lng: 12.4964, count: 6, spread: 0.0115 },
            { city: "Bologna", lat: 44.4949, lng: 11.3426, count: 3, spread: 0.0085 },
            { city: "Turin", lat: 45.0703, lng: 7.6869, count: 3, spread: 0.0085 },
        ],
    },
    Afghanistan: {
        phonePrefix: "+93701",
        cities: [
            { city: "Kabul", lat: 34.5553, lng: 69.2075, count: 8, spread: 0.0105 },
            { city: "Herat", lat: 34.3529, lng: 62.204, count: 5, spread: 0.0095 },
            { city: "Mazar-i-Sharif", lat: 36.709, lng: 67.11, count: 4, spread: 0.0095 },
            { city: "Kandahar", lat: 31.6289, lng: 65.7372, count: 3, spread: 0.0085 },
        ],
    },
};

function chunk(array, size) {
    const out = [];
    for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
    return out;
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function jitter(base, index, spread) {
    const pattern = [-2, -1, 0, 1, 2, -1.5, 1.5, -0.5, 0.5];
    const offset = pattern[index % pattern.length] * spread;
    return Number((base + offset).toFixed(6));
}

function timestampDaysAgo(days, hour = 10) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    d.setUTCHours(hour, (days * 7) % 60, 0, 0);
    return Timestamp.fromDate(d);
}

function safeInstagram(country, city, index) {
    const handle = `mapqa_${slugify(country)}_${slugify(city)}_${String(index + 1).padStart(2, "0")}`;
    return normalizeInstagramUrl(`https://instagram.com/${handle.slice(0, 30)}`);
}

function phoneForIndex(prefix, index) {
    return `${prefix}${String(100000 + index).padStart(6, "0")}`;
}

function makeName(city, index) {
    const padded = String(index + 1).padStart(2, "0");
    const name = `Map QA ${city} ${padded}`;
    return Array.from(name).slice(0, 60).join("");
}

function buildDocsForOwner({ uid, country }) {
    const plan = COUNTRY_PLANS[country];
    if (!plan) {
        throw new Error(`No country seed plan for ${country} (uid=${uid})`);
    }

    const docs = [];
    let runningIndex = 0;
    for (const cityPlan of plan.cities) {
        for (let i = 0; i < cityPlan.count; i += 1) {
            const lat = jitter(cityPlan.lat, i, cityPlan.spread);
            const lng = jitter(cityPlan.lng, i + 3, cityPlan.spread * 1.15);
            const name = makeName(cityPlan.city, runningIndex);
            const address = `${cityPlan.city}, Map QA Street ${101 + runningIndex}, ${country}`;
            const brands = BRAND_SETS[runningIndex % BRAND_SETS.length];
            const categoryGroup = CATEGORY_GROUPS[runningIndex % CATEGORY_GROUPS.length];
            const category = CATEGORIES[runningIndex % CATEGORIES.length];
            const subcategories = normalizeSubcategories([
                SUBCATEGORIES[runningIndex % SUBCATEGORIES.length],
                SUBCATEGORIES[(runningIndex + 2) % SUBCATEGORIES.length],
            ]);
            const createdAt = timestampDaysAgo(10 + runningIndex, 9 + (runningIndex % 5));
            const submittedAt = timestampDaysAgo(5 + runningIndex, 11 + (runningIndex % 4));
            const reviewedAt = timestampDaysAgo(4 + runningIndex, 13 + (runningIndex % 3));
            const geo = buildGeo({
                city: cityPlan.city,
                country,
                coords: { lat, lng },
                placeId: `${SEED_BATCH}-${slugify(uid)}-${slugify(cityPlan.city)}-${runningIndex + 1}`,
            });

            docs.push({
                ownerUid: uid,
                name,
                nameNormalized: normalizeShowroomName(name),
                type: runningIndex % 3 === 0 ? "unique" : "multibrand",
                availability: runningIndex % 2 === 0 ? "open" : "appointment",
                category,
                categoryGroup,
                subcategories,
                brands,
                brandsNormalized: normalizeBrands(brands),
                brandsMap: buildBrandsMap(brands),
                address,
                addressNormalized: normalizeAddress(address).toLowerCase(),
                country,
                city: cityPlan.city,
                location: { lat, lng },
                geo,
                contacts: {
                    phone: phoneForIndex(plan.phonePrefix, runningIndex),
                    instagram: safeInstagram(country, cityPlan.city, runningIndex),
                },
                status: "approved",
                editCount: 1,
                createdAt,
                updatedAt: reviewedAt,
                submittedAt,
                reviewedAt,
                reviewedBy: ADMIN_ACTOR,
                reviewReason: null,
                pendingSnapshot: null,
                deletedAt: null,
                deletedBy: null,
                editHistory: [
                    { action: "submit", at: submittedAt, statusBefore: "draft", statusAfter: "pending" },
                    { action: "approve", at: reviewedAt, statusBefore: "pending", statusAfter: "approved" },
                ],
                source: "seed",
                seedBatch: SEED_BATCH,
                seedTag: `${SEED_BATCH}-${slugify(uid)}-${slugify(cityPlan.city)}-${runningIndex + 1}`,
            });
            runningIndex += 1;
        }
    }

    return docs;
}

async function commitInChunks(db, operations) {
    for (const ops of chunk(operations, 350)) {
        const batch = db.batch();
        for (const op of ops) {
            if (op.type === "delete") batch.delete(op.ref);
            if (op.type === "set") batch.set(op.ref, op.data);
        }
        await batch.commit();
    }
}

async function main() {
    initFirebase();
    const db = getFirestoreInstance();
    const operations = [];
    const summary = [];

    for (const ownerPlan of OWNER_PLANS) {
        const userRef = db.collection("users").doc(ownerPlan.uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            throw new Error(`User not found: ${ownerPlan.uid}`);
        }

        const user = userSnap.data() || {};
        const country = user.country || ownerPlan.country;
        const docs = buildDocsForOwner({ uid: ownerPlan.uid, country });

        const existingSnap = await db.collection("showrooms").where("ownerUid", "==", ownerPlan.uid).get();
        const previousSeedDocs = existingSnap.docs.filter(doc => (doc.data()?.seedBatch || null) === SEED_BATCH);
        previousSeedDocs.forEach(doc => {
            operations.push({ type: "delete", ref: doc.ref });
        });

        docs.forEach(doc => {
            operations.push({
                type: "set",
                ref: db.collection("showrooms").doc(),
                data: doc,
            });
        });

        const cities = docs.reduce((acc, doc) => {
            acc[doc.city] = (acc[doc.city] || 0) + 1;
            return acc;
        }, {});

        summary.push({
            ownerUid: ownerPlan.uid,
            country,
            deletedPreviousSeeded: previousSeedDocs.length,
            inserted: docs.length,
            cities,
        });
    }

    await commitInChunks(db, operations);
    console.log(JSON.stringify({ seedBatch: SEED_BATCH, owners: summary }, null, 2));
}

main().catch(err => {
    console.error("Map QA showroom seed failed:", err);
    process.exit(1);
});
