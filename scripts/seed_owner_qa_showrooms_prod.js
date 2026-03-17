// Seed a curated QA showroom set for one real owner in production.
// Usage:
//   NODE_ENV=prod CONFIRM_PROD_SEED=YES TARGET_UID=<uid> node scripts/seed_owner_qa_showrooms_prod.js

import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import {
    normalizeShowroomName,
    normalizeBrands,
    normalizeAddress,
    buildBrandsMap,
    normalizeSubcategories,
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

const TARGET_UID = process.env.TARGET_UID || "5Q4vuh41ynN0EPeqVBaTAkAvmpB2";
const SEED_BATCH = `owner-qa-mix-v2-${TARGET_UID.slice(0, 6)}`;
const ADMIN_ACTOR = { uid: "system", role: "admin" };

const CATEGORY_GROUPS = ["clothing", "accessories"];
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
const BRAND_SETS = [
    ["Atelier North", "Quiet Form"],
    ["Borderline Studio", "Loom Edit"],
    ["Linear House", "Mila Edit"],
    ["Crafted Room", "Vivid Layer"],
    ["Foundry Wear", "Salt Wardrobe"],
    ["Trembita Line", "Stone Thread"],
];

const COUNTRY_PLANS = {
    Ukraine: {
        mainCity: { city: "Lviv", lat: 49.8397, lng: 24.0297, count: 20 },
        extraCities: [
            { city: "Uzhhorod", lat: 48.6208, lng: 22.2879, count: 4 },
            { city: "Chernivtsi", lat: 48.2915, lng: 25.9403, count: 4 },
            { city: "Mukachevo", lat: 48.4392, lng: 22.7178, count: 3 },
            { city: "Lutsk", lat: 50.7472, lng: 25.3254, count: 3 },
            { city: "Mostyska", lat: 49.7947, lng: 23.1505, count: 2 },
            { city: "Chop", lat: 48.4312, lng: 22.2056, count: 2 },
            { city: "Yavoriv", lat: 49.9387, lng: 23.3825, count: 2 },
        ],
        phonePrefix: "+38067",
    },
    Poland: {
        mainCity: { city: "Warszawa", lat: 52.2297, lng: 21.0122, count: 20 },
        extraCities: [
            { city: "Krakow", lat: 50.0647, lng: 19.945, count: 4 },
            { city: "Wroclaw", lat: 51.1079, lng: 17.0385, count: 4 },
            { city: "Gdansk", lat: 54.352, lng: 18.6466, count: 3 },
            { city: "Przemysl", lat: 49.7833, lng: 22.7678, count: 3 },
            { city: "Bialystok", lat: 53.1325, lng: 23.1688, count: 2 },
            { city: "Chelm", lat: 51.1431, lng: 23.4712, count: 2 },
            { city: "Rzeszow", lat: 50.0413, lng: 21.999, count: 2 },
        ],
        phonePrefix: "+48510",
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

function jitter(value, index, step = 0.0063) {
    const offset = ((index % 7) - 3) * step;
    return Number((value + offset).toFixed(6));
}

function timestampDaysAgo(days, hour = 10) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    d.setUTCHours(hour, (days * 11) % 60, 0, 0);
    return Timestamp.fromDate(d);
}

function safeInstagram(city, index, status) {
    const raw = `qa_${slugify(city).slice(0, 10)}_${status}_${index}`;
    return `https://instagram.com/${raw.slice(0, 30)}`;
}

function makeName(city, index, status, variant) {
    const padded = String(index).padStart(2, "0");
    const long = `${city} QA Borderline Atelier Signature Capsule ${padded}`;
    const medium = `QA ${city} Atelier ${padded}`;
    const short = `${city} QA ${padded}`;
    const edit = `QA ${city} Atelier Edit ${padded}`;
    const moderation = `QA ${city} Moderation ${status} ${padded}`;
    const names = [long, medium, short, edit, moderation];
    const name = names[variant % names.length];
    return Array.from(name).length <= 60 ? name : name.slice(0, 60).trim();
}

function buildStatusPlan() {
    return [
        ...Array.from({ length: 14 }, () => "approved"),
        ...Array.from({ length: 10 }, () => "pending"),
        ...Array.from({ length: 6 }, () => "rejected"),
        ...Array.from({ length: 7 }, () => "draft"),
        ...Array.from({ length: 3 }, () => "deleted"),
    ];
}

function buildCitySequence(plan) {
    const result = [];
    for (let i = 0; i < plan.mainCity.count; i += 1) result.push(plan.mainCity);
    for (const city of plan.extraCities) {
        for (let i = 0; i < city.count; i += 1) result.push(city);
    }
    return result;
}

function buildDoc({ ownerUid, country, phonePrefix, citySeed, index, status }) {
    const city = citySeed.city;
    const type = index % 3 === 0 ? "unique" : "multibrand";
    const categoryGroup = CATEGORY_GROUPS[index % CATEGORY_GROUPS.length];
    const category = CATEGORIES[index % CATEGORIES.length];
    const subcategories = normalizeSubcategories([
        SUBCATEGORIES[index % SUBCATEGORIES.length],
        SUBCATEGORIES[(index + 2) % SUBCATEGORIES.length],
        SUBCATEGORIES[(index + 4) % SUBCATEGORIES.length],
    ]);
    const brands = BRAND_SETS[index % BRAND_SETS.length];
    const lat = jitter(citySeed.lat, index);
    const lng = jitter(citySeed.lng, index + 2);
    const name = makeName(city, index + 1, status, index);
    const address = `${city}, QA Border Street ${101 + index}, ${country}`;
    const createdAt = timestampDaysAgo(5 + index, 9 + (index % 6));
    const submittedAt = timestampDaysAgo(Math.max(1, 3 + index), 11 + (index % 5));
    const reviewedAt = timestampDaysAgo(Math.max(0, 2 + index), 12 + (index % 4));
    const deletedAt = timestampDaysAgo(Math.max(0, 1 + index), 13 + (index % 3));
    const geo = buildGeo({
        city,
        country,
        coords: { lat, lng },
        placeId: `${SEED_BATCH}-${slugify(city)}-${index + 1}`,
    });
    const editCount = status === "pending" ? (index % 2 === 0 ? 0 : 2) : Math.min(3, 1 + (index % 3));

    const base = {
        ownerUid,
        name,
        nameNormalized: normalizeShowroomName(name),
        type,
        availability: index % 2 === 0 ? "open" : "appointment",
        category,
        categoryGroup,
        subcategories,
        brands,
        brandsNormalized: normalizeBrands(brands),
        brandsMap: buildBrandsMap(brands),
        address,
        addressNormalized: normalizeAddress(address).toLowerCase(),
        country,
        city,
        location: { lat, lng },
        geo,
        contacts: {
            phone: `${phonePrefix}${String(100000 + index).padStart(6, "0")}`,
            instagram: safeInstagram(city, index + 1, status),
        },
        status,
        editCount,
        createdAt,
        updatedAt: createdAt,
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
        pendingSnapshot: null,
        deletedAt: null,
        deletedBy: null,
        editHistory: [],
        source: "seed",
        seedBatch: SEED_BATCH,
        seedTag: `${SEED_BATCH}-${slugify(city)}-${status}-${index + 1}`,
    };

    if (status === "approved") {
        base.submittedAt = submittedAt;
        base.reviewedAt = reviewedAt;
        base.reviewedBy = ADMIN_ACTOR;
        base.updatedAt = reviewedAt;
        base.editHistory = [
            { action: "submit", at: submittedAt, statusBefore: "draft", statusAfter: "pending" },
            { action: "approve", at: reviewedAt, statusBefore: "pending", statusAfter: "approved" },
        ];
        return base;
    }

    if (status === "rejected") {
        base.submittedAt = submittedAt;
        base.reviewedAt = reviewedAt;
        base.reviewedBy = ADMIN_ACTOR;
        base.reviewReason = "QA rejection fixture";
        base.updatedAt = reviewedAt;
        base.editHistory = [
            { action: "submit", at: submittedAt, statusBefore: "draft", statusAfter: "pending" },
            { action: "reject", at: reviewedAt, statusBefore: "pending", statusAfter: "rejected" },
        ];
        return base;
    }

    if (status === "pending") {
        base.submittedAt = submittedAt;
        base.updatedAt = submittedAt;
        base.pendingSnapshot = {
            name: base.name,
            nameNormalized: base.nameNormalized,
            type: base.type,
            availability: base.availability,
            category: base.category,
            categoryGroup: base.categoryGroup,
            subcategories: base.subcategories,
            brands: base.brands,
            brandsNormalized: base.brandsNormalized,
            brandsMap: base.brandsMap,
            address: base.address,
            addressNormalized: base.addressNormalized,
            country: base.country,
            city: base.city,
            contacts: base.contacts,
            location: base.location,
            geo: base.geo,
            ownerUid: base.ownerUid,
        };
        base.editHistory = [
            { action: "submit", at: submittedAt, statusBefore: "draft", statusAfter: "pending" },
        ];
        return base;
    }

    if (status === "deleted") {
        base.deletedAt = deletedAt;
        base.deletedBy = ADMIN_ACTOR;
        base.updatedAt = deletedAt;
        base.editHistory = [
            { action: "delete", at: deletedAt, statusBefore: "approved", statusAfter: "deleted" },
        ];
        return base;
    }

    // draft
    base.editHistory = [];
    return base;
}

async function commitInChunks(db, operations) {
    for (const ops of chunk(operations, 400)) {
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
    const userRef = db.collection("users").doc(TARGET_UID);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        throw new Error(`User not found: ${TARGET_UID}`);
    }

    const user = userSnap.data() || {};
    const country = user.country || "Ukraine";
    const plan = COUNTRY_PLANS[country] || COUNTRY_PLANS.Ukraine;
    const citySequence = buildCitySequence(plan);
    const statusPlan = buildStatusPlan();

    if (citySequence.length !== 40 || statusPlan.length !== 40) {
        throw new Error(`Unexpected plan sizes: cities=${citySequence.length}, statuses=${statusPlan.length}`);
    }

    const existingSnap = await db.collection("showrooms").where("ownerUid", "==", TARGET_UID).get();
    const operations = existingSnap.docs.map(doc => ({ type: "delete", ref: doc.ref }));

    const docs = citySequence.map((citySeed, index) =>
        buildDoc({
            ownerUid: TARGET_UID,
            country,
            phonePrefix: plan.phonePrefix,
            citySeed,
            index,
            status: statusPlan[index],
        })
    );

    for (const doc of docs) {
        operations.push({
            type: "set",
            ref: db.collection("showrooms").doc(),
            data: doc,
        });
    }

    await commitInChunks(db, operations);

    const summary = docs.reduce((acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        acc[doc.city] = (acc[doc.city] || 0) + 1;
        return acc;
    }, {});

    console.log(
        JSON.stringify(
            {
                ownerUid: TARGET_UID,
                country,
                deletedExisting: existingSnap.size,
                inserted: docs.length,
                statuses: {
                    approved: summary.approved || 0,
                    pending: summary.pending || 0,
                    rejected: summary.rejected || 0,
                    draft: summary.draft || 0,
                    deleted: summary.deleted || 0,
                },
                cities: Object.fromEntries(
                    Object.entries(summary).filter(([key]) => !["approved", "pending", "rejected", "draft", "deleted"].includes(key))
                ),
            },
            null,
            2
        )
    );
}

main().catch(err => {
    console.error("QA showroom seed failed:", err);
    process.exit(1);
});
