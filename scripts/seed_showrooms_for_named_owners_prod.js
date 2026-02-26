// Seed showrooms for specific real owner UIDs in production.
// Usage:
//   NODE_ENV=prod CONFIRM_PROD_SEED=YES node scripts/seed_showrooms_for_named_owners_prod.js

import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
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

const SEED_BATCH = "owners-it-cz-ua-v1";
const ADMIN_REVIEWER = { uid: "system", role: "admin" };

const OWNERS = {
    italy: {
        uid: "fCKueXcEqNe3X0Z2TbILsSKq4j83",
        country: "Italy",
        user: {
            name: "Giulia Bianchi",
            position: "Fondatrice e buyer",
            instagram: "https://instagram.com/giulia.bianchi.showroom",
        },
        locale: "it",
    },
    czech: {
        uid: "eQ9vG8jvlCaz1VWyYRbzf5EHsNf2",
        country: "Czechia",
        user: {
            name: "Tereza Nováková",
            position: "Zakladatelka a kurátorka značek",
            instagram: "https://instagram.com/tereza.novakova.showroom",
        },
        locale: "cs",
    },
    ukraine: {
        uid: "aNcpDe4EbeUEX5nEUnNU3uTLny52",
        country: "Ukraine",
        user: {
            name: "Олена Марченко",
            position: "Засновниця та кураторка брендів",
            instagram: "https://instagram.com/olena.marchenko.showroom",
        },
        locale: "uk",
    },
};

const ITALY_CITIES = [
    { city: "Rome", lat: 41.9028, lng: 12.4964 },
    { city: "Milan", lat: 45.4642, lng: 9.19 },
    { city: "Naples", lat: 40.8518, lng: 14.2681 },
    { city: "Turin", lat: 45.0703, lng: 7.6869 },
    { city: "Florence", lat: 43.7696, lng: 11.2558 },
    { city: "Bologna", lat: 44.4949, lng: 11.3426 },
    { city: "Verona", lat: 45.4384, lng: 10.9916 },
    { city: "Venice", lat: 45.4408, lng: 12.3155 },
    { city: "Genoa", lat: 44.4056, lng: 8.9463 },
    { city: "Palermo", lat: 38.1157, lng: 13.3615 },
    { city: "Catania", lat: 37.5079, lng: 15.083 },
    { city: "Bari", lat: 41.1171, lng: 16.8719 },
    { city: "Padua", lat: 45.4064, lng: 11.8768 },
    { city: "Parma", lat: 44.8015, lng: 10.3279 },
    { city: "Trieste", lat: 45.6495, lng: 13.7768 },
    { city: "Bergamo", lat: 45.6983, lng: 9.6773 },
    { city: "Como", lat: 45.8081, lng: 9.0852 },
    { city: "Lecce", lat: 40.3515, lng: 18.175 },
    { city: "Perugia", lat: 43.1107, lng: 12.3908 },
    { city: "Siena", lat: 43.3188, lng: 11.3308 },
];

const CZECH_CITIES = [
    { city: "Prague", lat: 50.0755, lng: 14.4378 },
    { city: "Brno", lat: 49.1951, lng: 16.6068 },
    { city: "Ostrava", lat: 49.8209, lng: 18.2625 },
    { city: "Plzen", lat: 49.7384, lng: 13.3736 },
    { city: "Liberec", lat: 50.7663, lng: 15.0543 },
];

const UKRAINE_SMALL_CITIES = [
    { city: "Bucha", lat: 50.5441, lng: 30.2144 },
    { city: "Irpin", lat: 50.5218, lng: 30.2506 },
    { city: "Vyshneve", lat: 50.3891, lng: 30.3705 },
    { city: "Brovary", lat: 50.5119, lng: 30.7902 },
    { city: "Boryspil", lat: 50.345, lng: 30.955 },
    { city: "Obukhiv", lat: 50.1069, lng: 30.6182 },
    { city: "Fastiv", lat: 50.0768, lng: 29.9177 },
    { city: "Vyshhorod", lat: 50.5848, lng: 30.4898 },
    { city: "Bila Tserkva", lat: 49.7968, lng: 30.1311 },
    { city: "Drohobych", lat: 49.3563, lng: 23.5123 },
    { city: "Stryi", lat: 49.2622, lng: 23.8561 },
    { city: "Chervonohrad", lat: 50.391, lng: 24.2351 },
    { city: "Sambir", lat: 49.5183, lng: 23.2028 },
    { city: "Mukachevo", lat: 48.4392, lng: 22.7178 },
    { city: "Berehove", lat: 48.2056, lng: 22.6442 },
    { city: "Kolomyia", lat: 48.5312, lng: 25.0365 },
    { city: "Kalush", lat: 49.0448, lng: 24.3731 },
    { city: "Chortkiv", lat: 49.0171, lng: 25.7982 },
    { city: "Kremenets", lat: 50.0969, lng: 25.7276 },
    { city: "Dubno", lat: 50.4163, lng: 25.7343 },
    { city: "Nizhyn", lat: 51.048, lng: 31.8869 },
    { city: "Pryluky", lat: 50.5932, lng: 32.3876 },
    { city: "Konotop", lat: 51.2403, lng: 33.2026 },
    { city: "Uman", lat: 48.7484, lng: 30.2218 },
    { city: "Smila", lat: 49.2224, lng: 31.8871 },
    { city: "Oleksandriia", lat: 48.6696, lng: 33.1159 },
    { city: "Kamianske", lat: 48.5079, lng: 34.6132 },
    { city: "Pivdenne", lat: 46.6221, lng: 31.1013 },
    { city: "Truskavets", lat: 49.2784, lng: 23.5062 },
    { city: "Yaremche", lat: 48.4519, lng: 24.5544 },
];

const BRANDS = {
    it: [
        ["Atelier Nido", "Luce Studio"],
        ["Casa Velluto", "Linea Alba"],
        ["Stella Forma", "Marea Cielo"],
    ],
    cs: [
        ["Ateliér Vlnka", "Městský Styl"],
        ["Studio Lotos", "Něžná Linie"],
        ["Praha Edit", "Světlá Ulice"],
    ],
    uk: [
        ["Майстерня Ранок", "Тиха Вулиця"],
        ["Лінія Міста", "Квітка Studio"],
        ["Дім Текстур", "Світла Колекція"],
    ],
};

const SUBCATEGORIES = ["outerwear", "dresses", "suits", "knitwear", "footwear"];

function nowIso() {
    return new Date().toISOString();
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function jitterCoord(base, seed) {
    const offset = ((seed % 5) - 2) * 0.0047;
    return Number((base + offset).toFixed(6));
}

function makePhone(prefix, index) {
    return `+${prefix}${String(10000000 + index).padStart(8, "0")}`;
}

function isoDaysAgo(days, hourOffset = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    d.setUTCHours(10 + hourOffset, (days * 7) % 60, 0, 0);
    return d.toISOString();
}

function localizedShowroomName(locale, city, index, type) {
    const variants = {
        it: [
            `Atelier ${city}`,
            `Casa Moda ${city}`,
            `Studio Stile ${city}`,
            `Salotto Tessile ${city}`,
            `Galleria Abiti ${city}`,
        ],
        cs: [
            `Ateliér ${city}`,
            `Módní Studio ${city}`,
            `Kurátor ${city}`,
            `Městský Salon ${city}`,
            `Šatník ${city}`,
        ],
        uk: [
            `Шоурум «${city}»`,
            `Ательє «${city} стиль»`,
            `Простір «${city} look»`,
            `Студія «${city} колекція»`,
            `Модний дім «${city}»`,
        ],
    };
    const base = variants[locale][index % variants[locale].length];
    return type === "unique" ? `${base} • Select` : `${base} • Multibrand`;
}

function localizedAddress(locale, city, index) {
    if (locale === "it") return `Via della Moda ${10 + index}, ${city}, Italia`;
    if (locale === "cs") return `Ulice Módy ${10 + index}, ${city}, Česko`;
    return `вул. Стильна ${10 + index}, ${city}, Україна`;
}

function makeApprovedHistory(submittedAt, reviewedAt) {
    return [
        {
            action: "submit",
            at: submittedAt,
            statusBefore: "draft",
            statusAfter: "pending",
        },
        {
            action: "approve",
            at: reviewedAt,
            statusBefore: "pending",
            statusAfter: "approved",
        },
    ];
}

function makeRejectedHistory(submittedAt, reviewedAt) {
    return [
        {
            action: "submit",
            at: submittedAt,
            statusBefore: "draft",
            statusAfter: "pending",
        },
        {
            action: "reject",
            at: reviewedAt,
            statusBefore: "pending",
            statusAfter: "rejected",
        },
    ];
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

function buildShowroomDoc({
    owner,
    citySeed,
    seq,
    status,
    countryPhoneCode,
    forceType = null,
}) {
    const locale = owner.locale;
    const type = forceType || (seq % 3 === 0 ? "unique" : "multibrand");
    const availability = seq % 2 === 0 ? "open" : "appointment";
    const categoryGroup = "clothing";
    const category = seq % 2 === 0 ? "womenswear" : "menswear";
    const subcategories = normalizeSubcategories([
        SUBCATEGORIES[seq % SUBCATEGORIES.length],
        SUBCATEGORIES[(seq + 2) % SUBCATEGORIES.length],
    ]);
    const brands = BRANDS[locale][seq % BRANDS[locale].length];
    const city = citySeed.city;
    const lat = jitterCoord(citySeed.lat, seq);
    const lng = jitterCoord(citySeed.lng, seq + 3);
    const name = localizedShowroomName(locale, city, seq, type);
    const address = localizedAddress(locale, city, seq);
    // Backdate seed data across roughly the last year for analytics/demo charts.
    // Timestamps may predate actual project launch date intentionally (seed-only scenario).
    const createdDaysAgo = 20 + ((seq * 17) % 330); // ~20..349 days ago
    const submittedDaysAgo = Math.max(1, createdDaysAgo - 2);
    const reviewedDaysAgo = Math.max(0, createdDaysAgo - 1);
    const createdAt = isoDaysAgo(createdDaysAgo, seq % 5);
    const submittedAt = isoDaysAgo(submittedDaysAgo, (seq + 1) % 5);
    const reviewedAt = isoDaysAgo(reviewedDaysAgo, (seq + 2) % 5);
    const instagram = `https://instagram.com/${slugify(`${owner.locale}-${city}-${seq}`)}`;

    const geo = buildGeo({
        city,
        country: owner.country,
        coords: { lat, lng },
        placeId: `seed-${SEED_BATCH}-${owner.locale}-${slugify(city)}-${seq}`,
    });

    const base = {
        ownerUid: owner.uid,
        status,
        createdAt,
        updatedAt: status === "pending" ? submittedAt : reviewedAt,
        name,
        nameNormalized: normalizeShowroomName(name),
        type,
        availability,
        category,
        categoryGroup,
        subcategories,
        brands,
        brandsNormalized: normalizeBrands(brands),
        brandsMap: buildBrandsMap(brands),
        country: owner.country,
        address,
        addressNormalized: normalizeAddress(address).toLowerCase(),
        city,
        location: { lat, lng },
        geo,
        contacts: {
            phone: makePhone(countryPhoneCode, seq),
            instagram,
        },
        source: "seed",
        seedBatch: SEED_BATCH,
        seedTag: `${SEED_BATCH}-${owner.locale}-${slugify(city)}-${seq}`,
    };

    if (status === "approved") {
        return {
            ...base,
            submittedAt,
            reviewedAt,
            reviewedBy: ADMIN_REVIEWER,
            reviewReason: null,
            pendingSnapshot: null,
            editCount: 2,
            editHistory: makeApprovedHistory(submittedAt, reviewedAt),
        };
    }

    if (status === "rejected") {
        return {
            ...base,
            submittedAt,
            reviewedAt,
            reviewedBy: ADMIN_REVIEWER,
            reviewReason: owner.locale === "uk"
                ? "Потрібно уточнити контакти та опис шоуруму"
                : "Needs profile clarification",
            pendingSnapshot: null,
            editCount: 2,
            editHistory: makeRejectedHistory(submittedAt, reviewedAt),
        };
    }

    // pending
    const pendingBase = {
        ...base,
        status: "pending",
        submittedAt,
        updatedAt: submittedAt,
        reviewReason: null,
        pendingSnapshot: null,
        editCount: 1,
        editHistory: [
            {
                action: "submit",
                at: submittedAt,
                statusBefore: "draft",
                statusAfter: "pending",
            },
        ],
    };
    pendingBase.pendingSnapshot = buildPendingSnapshot(pendingBase);
    return pendingBase;
}

function buildItalySeeds() {
    return ITALY_CITIES.map((citySeed, idx) => ({
        owner: OWNERS.italy,
        citySeed,
        seq: idx + 1,
        status: "approved",
        countryPhoneCode: "39",
    }));
}

function buildCzechSeeds() {
    const seeds = [];
    let seq = 0;
    for (const citySeed of CZECH_CITIES) {
        for (let i = 0; i < 6; i += 1) {
            seq += 1;
            seeds.push({
                owner: OWNERS.czech,
                citySeed,
                seq,
                status: "approved",
                countryPhoneCode: "420",
            });
        }
    }
    return seeds;
}

function buildUkraineSeeds() {
    const statuses = [
        "approved", "rejected", "pending",
        "approved", "pending", "rejected",
        "approved", "approved", "pending", "rejected",
    ];
    return UKRAINE_SMALL_CITIES.map((citySeed, idx) => ({
        owner: OWNERS.ukraine,
        citySeed,
        seq: idx + 1,
        status: statuses[idx % statuses.length],
        countryPhoneCode: "380",
    }));
}

async function ensureOwnerProfile(userRef, ownerConfig) {
    const snap = await userRef.get();
    if (!snap.exists) {
        throw new Error(`User not found: ${ownerConfig.uid}`);
    }
    const data = snap.data() || {};
    const existingRoles = Array.isArray(data.roles) ? data.roles : [];
    const roles = Array.from(new Set([...existingRoles, "owner"]));

    return {
        ref: userRef,
        update: {
            role: "owner",
            roles,
            onboardingState: "completed",
            country: ownerConfig.country,
            name: ownerConfig.user.name,
            ownerProfile: {
                name: ownerConfig.user.name,
                position: ownerConfig.user.position,
                instagram: ownerConfig.user.instagram,
            },
            updatedAt: nowIso(),
        },
        beforeRole: data.role ?? null,
    };
}

async function main() {
    initFirebase();
    const db = getFirestoreInstance();

    const ownerConfigs = Object.values(OWNERS);
    const ownerUpdates = [];
    for (const owner of ownerConfigs) {
        ownerUpdates.push(await ensureOwnerProfile(db.collection("users").doc(owner.uid), owner));
    }

    const seeds = [
        ...buildItalySeeds(),
        ...buildCzechSeeds(),
        ...buildUkraineSeeds(),
    ];

    if (seeds.length !== 80) {
        throw new Error(`Unexpected seed count: ${seeds.length} (expected 80)`);
    }

    const docs = seeds.map(seed => buildShowroomDoc(seed));

    const batch = db.batch();
    for (const item of ownerUpdates) {
        batch.update(item.ref, item.update);
    }
    for (const doc of docs) {
        const ref = db.collection("showrooms").doc();
        batch.set(ref, doc);
    }
    await batch.commit();

    const summary = {
        italyApproved: docs.filter(d => d.ownerUid === OWNERS.italy.uid && d.status === "approved").length,
        czechApproved: docs.filter(d => d.ownerUid === OWNERS.czech.uid && d.status === "approved").length,
        ukraineApproved: docs.filter(d => d.ownerUid === OWNERS.ukraine.uid && d.status === "approved").length,
        ukraineRejected: docs.filter(d => d.ownerUid === OWNERS.ukraine.uid && d.status === "rejected").length,
        ukrainePending: docs.filter(d => d.ownerUid === OWNERS.ukraine.uid && d.status === "pending").length,
        total: docs.length,
    };

    console.log("Seed completed:", summary);
    console.log("Owner updates:", ownerUpdates.map(item => ({
        uid: item.ref.id,
        role: item.update.role,
        country: item.update.country,
        ownerName: item.update.ownerProfile?.name,
    })));
}

main().catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
});
