// Seed 10 Ukraine showrooms for each provided owner in prod.
// Mix per owner: 7 approved, 1 pending, 1 rejected, 1 draft.
// Usage:
//   NODE_ENV=prod CONFIRM_PROD_SEED=YES node scripts/seed_ukraine_major_owner_showrooms_prod.js

import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import {
    normalizeAddress,
    normalizeBrands,
    normalizeShowroomName,
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

const SEED_BATCH = "ua-major-cities-v1";
const COUNTRY = "Ukraine";
const ADMIN_REVIEWER = { uid: "system", role: "admin" };

const OWNERS = [
    {
        uid: "JrI0yUQcEcf6HhalcGIGTKYPN4f2",
        user: {
            name: "Dev Owner UA 01",
            instagram: "https://instagram.com/dev.owner.ua01",
            position: "Founder",
        },
    },
    {
        uid: "KY3vRhLtvDfwX7ijXADVjKCjqpH2",
        user: {
            name: "Dev Owner UA 02",
            instagram: "https://instagram.com/dev.owner.ua02",
            position: "Buyer",
        },
    },
];

const CITY_SEEDS = [
    { city: "Kyiv", lat: 50.4501, lng: 30.5234, status: "approved" },
    { city: "Odesa", lat: 46.4825, lng: 30.7233, status: "approved" },
    { city: "Zaporizhzhia", lat: 47.8388, lng: 35.1396, status: "approved" },
    { city: "Cherkasy", lat: 49.4444, lng: 32.0598, status: "approved" },
    { city: "Lviv", lat: 49.8397, lng: 24.0297, status: "approved" },
    { city: "Dnipro", lat: 48.4647, lng: 35.0462, status: "approved" },
    { city: "Kharkiv", lat: 49.9935, lng: 36.2304, status: "approved" },
    { city: "Vinnytsia", lat: 49.2328, lng: 28.4810, status: "pending" },
    { city: "Poltava", lat: 49.5883, lng: 34.5514, status: "rejected" },
    { city: "Ivano-Frankivsk", lat: 48.9226, lng: 24.7111, status: "draft" },
];

const BRAND_SETS = [
    ["Dawn Atelier", "North Edit"],
    ["Blue Thread", "City Form"],
    ["Quiet Studio", "Mode Line"],
];

const SUBCATEGORY_SETS = [
    ["outerwear", "dresses"],
    ["suits", "knitwear"],
    ["footwear"],
];

function nowIso() {
    return new Date().toISOString();
}

function isoDaysAgo(days, minuteOffset = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    d.setUTCMinutes(d.getUTCMinutes() - minuteOffset);
    return d.toISOString();
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function jitterCoord(base, seed) {
    const offset = ((seed % 5) - 2) * 0.0061;
    return Number((base + offset).toFixed(6));
}

function makePhone(ownerIndex, cityIndex) {
    return `+38067${String(ownerIndex * 10000 + cityIndex + 1000).padStart(7, "0")}`;
}

function makeHistory(status, submittedAt, reviewedAt) {
    const history = [
        {
            action: "submit",
            at: submittedAt,
            actor: { uid: null, role: "owner" },
            statusBefore: "draft",
            statusAfter: "pending",
            changedFields: [],
            diff: {},
        },
    ];
    if (status === "approved") {
        history.push({
            action: "approve",
            at: reviewedAt,
            actor: ADMIN_REVIEWER,
            statusBefore: "pending",
            statusAfter: "approved",
            changedFields: ["status"],
            diff: { status: { from: "pending", to: "approved" } },
        });
    }
    if (status === "rejected") {
        history.push({
            action: "reject",
            at: reviewedAt,
            actor: ADMIN_REVIEWER,
            statusBefore: "pending",
            statusAfter: "rejected",
            changedFields: ["status"],
            diff: { status: { from: "pending", to: "rejected" } },
        });
    }
    return history;
}

function buildPendingSnapshot(base) {
    return {
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
}

function buildShowroom(owner, ownerIndex, citySeed, cityIndex) {
    const brands = BRAND_SETS[(ownerIndex + cityIndex) % BRAND_SETS.length];
    const subcategories = normalizeSubcategories(
        SUBCATEGORY_SETS[(ownerIndex + cityIndex) % SUBCATEGORY_SETS.length]
    );
    const type = cityIndex % 3 === 0 ? "unique" : "multibrand";
    const availability = cityIndex % 2 === 0 ? "open" : "appointment";
    const name = `${citySeed.city} Showroom ${ownerIndex + 1}-${cityIndex + 1} ${SEED_BATCH}`;
    const address = normalizeAddress(
        `${citySeed.city}, Fashion Avenue ${20 + cityIndex}, ${COUNTRY}`
    );
    const lat = jitterCoord(citySeed.lat, ownerIndex + cityIndex);
    const lng = jitterCoord(citySeed.lng, cityIndex + ownerIndex + 7);
    const geo = buildGeo({
        city: citySeed.city,
        country: COUNTRY,
        coords: { lat, lng },
        placeId: `seed-${SEED_BATCH}-${slugify(owner.uid)}-${slugify(citySeed.city)}`,
    });

    const createdAt = isoDaysAgo(10 - cityIndex, ownerIndex * 3 + cityIndex);
    const submittedAt = citySeed.status === "draft" ? null : isoDaysAgo(9 - cityIndex, ownerIndex * 5 + cityIndex);
    const reviewedAt = citySeed.status === "approved" || citySeed.status === "rejected"
        ? isoDaysAgo(8 - cityIndex, ownerIndex * 7 + cityIndex)
        : null;

    const base = {
        ownerUid: owner.uid,
        name,
        nameNormalized: normalizeShowroomName(name),
        type,
        availability,
        category: "womenswear",
        categoryGroup: "clothing",
        subcategories,
        brands,
        brandsNormalized: normalizeBrands(brands),
        brandsMap: buildBrandsMap(brands),
        address,
        addressNormalized: address.toLowerCase(),
        country: COUNTRY,
        city: citySeed.city,
        geo,
        contacts: {
            phone: makePhone(ownerIndex + 1, cityIndex + 1),
            instagram: `${owner.user.instagram}.${slugify(citySeed.city)}`,
        },
        location: { lat, lng },
        status: citySeed.status,
        editCount: citySeed.status === "draft" ? 0 : 1,
        createdAt,
        updatedAt: reviewedAt ?? submittedAt ?? createdAt,
        submittedAt,
        reviewedAt,
        reviewedBy: reviewedAt ? ADMIN_REVIEWER : null,
        reviewReason: citySeed.status === "rejected" ? "Seeded rejection for moderation QA" : null,
        pendingSnapshot: citySeed.status === "pending" ? buildPendingSnapshot({
            ownerUid: owner.uid,
            name,
            nameNormalized: normalizeShowroomName(name),
            type,
            availability,
            category: "womenswear",
            categoryGroup: "clothing",
            subcategories,
            brands,
            brandsNormalized: normalizeBrands(brands),
            brandsMap: buildBrandsMap(brands),
            address,
            addressNormalized: address.toLowerCase(),
            country: COUNTRY,
            city: citySeed.city,
            contacts: {
                phone: makePhone(ownerIndex + 1, cityIndex + 1),
                instagram: `${owner.user.instagram}.${slugify(citySeed.city)}`,
            },
            location: { lat, lng },
            geo,
        }) : null,
        editHistory: citySeed.status === "draft"
            ? []
            : makeHistory(citySeed.status, submittedAt, reviewedAt),
        deletedAt: null,
        deletedBy: null,
        source: "seed",
        seedBatch: SEED_BATCH,
        seedOwnerIndex: ownerIndex + 1,
    };

    return base;
}

async function cleanupExistingBatch(db, ownerUid) {
    const snapshot = await db.collection("showrooms").where("ownerUid", "==", ownerUid).get();
    const seededDocs = snapshot.docs.filter(doc => doc.data()?.seedBatch === SEED_BATCH);
    for (const doc of seededDocs) {
        await doc.ref.delete();
    }
    return seededDocs.length;
}

async function upsertOwner(db, owner) {
    const ref = db.collection("users").doc(owner.uid);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new Error(`User ${owner.uid} not found in Firestore users collection`);
    }

    await ref.set({
        name: owner.user.name,
        country: COUNTRY,
        onboardingState: "completed",
        role: "owner",
        roles: ["owner"],
        ownerProfile: {
            name: owner.user.name,
            position: owner.user.position,
            instagram: owner.user.instagram,
        },
        updatedAt: nowIso(),
    }, { merge: true });
}

async function main() {
    initFirebase();
    const db = getFirestoreInstance();

    const summary = [];

    for (let ownerIndex = 0; ownerIndex < OWNERS.length; ownerIndex += 1) {
        const owner = OWNERS[ownerIndex];
        await upsertOwner(db, owner);
        const deletedOld = await cleanupExistingBatch(db, owner.uid);

        const batch = db.batch();
        const createdIds = [];

        for (let cityIndex = 0; cityIndex < CITY_SEEDS.length; cityIndex += 1) {
            const showroom = buildShowroom(owner, ownerIndex, CITY_SEEDS[cityIndex], cityIndex);
            const ref = db.collection("showrooms").doc();
            batch.set(ref, showroom);
            createdIds.push({ id: ref.id, city: CITY_SEEDS[cityIndex].city, status: CITY_SEEDS[cityIndex].status });
        }

        await batch.commit();
        summary.push({
            ownerUid: owner.uid,
            deletedOld,
            createdCount: createdIds.length,
            createdIds,
        });
    }

    console.log(JSON.stringify({ seedBatch: SEED_BATCH, owners: summary }, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
