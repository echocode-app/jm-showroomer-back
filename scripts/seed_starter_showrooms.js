import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { getFirestoreInstance } from "../src/config/firebase.js";
import {
    buildBrandsMap,
    normalizeAddress,
    normalizeAddressForCompare,
    normalizeBrands,
    normalizeInstagramUrl,
    normalizeShowroomName,
    validateInstagramUrl,
    validatePhone,
} from "../src/utils/showroomValidation.js";
import { buildGeo } from "../src/utils/geoValidation.js";

const ENV = process.env.NODE_ENV || "dev";
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

try {
    await fs.access(envFile);
    dotenv.config({ path: envFile });
} catch {
    // Allow runtime env only.
}

const argv = process.argv.slice(2);
const args = new Set(argv);
const dryRun = !args.has("--execute");
const allowProd = args.has("--allow-prod");

if (ENV === "prod" && !allowProd) {
    console.error("Refusing to seed production starter showrooms without --allow-prod");
    process.exit(1);
}

// Starter showroom records are real launch data from the store workbook, not mock fixtures.
const STARTER_SHOWROOMS = [
    {
        id: "starter_showroom_001_vsi_svoi",
        name: "Всі. Свої",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Мультибрендовий",
        address: "м. Київ, вул. Хрещатик, 27",
        city: "Kyiv",
        instagram: "@vsisvoi.ua",
        phone: "+380 75 102 84 25",
        coords: { lat: 50.4441005, lng: 30.5216029 },
    },
    {
        id: "starter_showroom_002_cher_17",
        name: "CHER'17",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Велика Васильківська, 12",
        city: "Kyiv",
        instagram: "@cher17.ua",
        phone: "+380 68 926 00 38",
        coords: { lat: 50.4405721, lng: 30.5185601 },
    },
    {
        id: "starter_showroom_003_coosh",
        name: "COOSH",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Антоновича, 16",
        city: "Kyiv",
        instagram: "@coosh.wear",
        phone: "+380 97 274 80 01",
        coords: { lat: 50.4375223, lng: 30.5132917 },
    },
    {
        id: "starter_showroom_004_kachorovska",
        name: "Kachorovska",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Боричів Тік, 35А",
        city: "Kyiv",
        instagram: "@kachorovska_shoes",
        phone: "+380 97 987 88 00",
        coords: { lat: 50.4616421, lng: 30.5158786 },
    },
    {
        id: "starter_showroom_005_gunia_project",
        name: "Gunia Project",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Антоновича, 4/6",
        city: "Kyiv",
        instagram: "@gunia_project",
        phone: "+380 67 440 22 44",
        coords: { lat: 50.4390186, lng: 30.5133314 },
    },
    {
        id: "starter_showroom_006_musthave",
        name: "MustHave",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Берковецька, 6Д (ТРЦ Lavina Mall)",
        city: "Kyiv",
        instagram: "@musthaveua",
        phone: "+380 44 355 55 00",
        coords: { lat: 50.4955348, lng: 30.3605824 },
    },
    {
        id: "starter_showroom_007_one_by_one",
        name: "One by One",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Львів, вул. Коперника, 12",
        city: "Lviv",
        instagram: "@onebyoneua",
        phone: "+380 67 361 11 62",
        coords: { lat: 49.8390242, lng: 24.0269168 },
    },
    {
        id: "starter_showroom_008_guzema_fine_jewelry",
        name: "Guzema Fine Jewelry",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Євгена Чикаленка, 9А",
        city: "Kyiv",
        instagram: "@guzema_jewelry",
        phone: "+380 67 112 34 56",
        coords: { lat: 50.4463078, lng: 30.5189854 },
    },
    {
        id: "starter_showroom_009_jul",
        name: "Jul",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Мечникова, 6",
        city: "Kyiv",
        instagram: "@jul.com.ua",
        phone: "+380 93 170 54 65",
        coords: { lat: 50.4370896, lng: 30.5287834 },
    },
    {
        id: "starter_showroom_010_ttswtrs",
        name: "TTSWTRS",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Стрілецька, 12",
        city: "Kyiv",
        instagram: "@ttswtrs",
        phone: "+380 67 444 81 22",
        coords: { lat: 50.4535441, lng: 30.5119307 },
    },
    {
        id: "starter_showroom_011_ruslan_baginskiy",
        name: "Ruslan Baginskiy",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Хрещатик, 15 (Пасаж)",
        city: "Kyiv",
        instagram: "@ruslanbaginskiy_hats",
        phone: "+380 50 315 15 50",
        coords: { lat: 50.4477854, lng: 30.5247899 },
    },
    {
        id: "starter_showroom_012_katsurina",
        name: "Katsurina",
        availabilityLabel: "Працює за попереднім записом",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Михайлівська, 24А",
        city: "Kyiv",
        instagram: "@katsurina.online",
        phone: "+380 67 500 20 40",
        coords: { lat: 50.4544745, lng: 30.5213196 },
    },
    {
        id: "starter_showroom_013_kseniaschnaider",
        name: "Kseniaschnaider",
        availabilityLabel: "Працює за попереднім записом",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Воздвиженська, 60",
        city: "Kyiv",
        instagram: "@kseniaschnaider",
        phone: "+380 50 440 01 10",
        coords: { lat: 50.459288, lng: 30.5154997 },
    },
    {
        id: "starter_showroom_014_litkovska",
        name: "Litkovska",
        availabilityLabel: "Працює за попереднім записом",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Шота Руставелі, 11",
        city: "Kyiv",
        instagram: "@litkovska_official",
        phone: "+380 50 333 44 55",
        coords: { lat: 50.439109, lng: 30.520676 },
    },
    {
        id: "starter_showroom_015_bevza",
        name: "Bevza",
        availabilityLabel: "Працює за попереднім записом",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Кожум'яцька, 12Г",
        city: "Kyiv",
        instagram: "@bevza",
        phone: "+380 44 222 11 00",
        coords: { lat: 50.4610154, lng: 30.5082575 },
    },
    {
        id: "starter_showroom_016_cultnaked",
        name: "Cultnaked",
        availabilityLabel: "Працює за попереднім записом",
        typeLabel: "Унікальний",
        address: "м. Львів, вул. Староєврейська, 15",
        city: "Lviv",
        instagram: "@cultnaked",
        phone: "+380 93 777 88 99",
        coords: { lat: 49.840823, lng: 24.0324319 },
    },
    {
        id: "starter_showroom_017_sleeper",
        name: "Sleeper",
        availabilityLabel: "Працює за попереднім записом",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Шовковична, 42",
        city: "Kyiv",
        instagram: "@daily_sleeper",
        phone: "+380 63 111 22 33",
        coords: { lat: 50.440262, lng: 30.5266833 },
    },
    {
        id: "starter_showroom_018_have_a_rest",
        name: "Have A Rest",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Велика Васильківська, 48",
        city: "Kyiv",
        instagram: "@havearest.me",
        phone: "+380 67 800 90 90",
        coords: { lat: 50.4364095, lng: 30.5156409 },
    },
    {
        id: "starter_showroom_019_gepur",
        name: "Gepur",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Одеса, вул. Дерибасівська, 21",
        city: "Odesa",
        instagram: "@gepur",
        phone: "+380 800 21 44 24",
        coords: { lat: 46.4836349, lng: 30.7373888 },
    },
    {
        id: "starter_showroom_020_minnim",
        name: "Minnim",
        availabilityLabel: "Вільний доступ",
        typeLabel: "Унікальний",
        address: "м. Київ, вул. Кожум'яцька, 16Б",
        city: "Kyiv",
        instagram: "@minnim_denim",
        phone: "+380 99 450 60 70",
        coords: { lat: 50.4604109, lng: 30.5089344 },
    },
];

const TYPE_BY_LABEL = new Map([
    ["Мультибрендовий", "multibrand"],
    ["Унікальний", "unique"],
]);

const AVAILABILITY_BY_LABEL = new Map([
    ["Вільний доступ", "open"],
    ["Працює за попереднім записом", "appointment"],
]);

function instagramToUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const handle = raw.startsWith("@") ? raw.slice(1) : raw;
    return normalizeInstagramUrl(`https://www.instagram.com/${handle}`);
}

function buildDoc(record, existing = null) {
    const type = TYPE_BY_LABEL.get(record.typeLabel);
    const availability = AVAILABILITY_BY_LABEL.get(record.availabilityLabel);
    if (!type) throw new Error(`Unsupported type label for ${record.name}: ${record.typeLabel}`);
    if (!availability) {
        throw new Error(`Unsupported availability label for ${record.name}: ${record.availabilityLabel}`);
    }

    const instagram = instagramToUrl(record.instagram);
    validateInstagramUrl(instagram);
    const { e164: phone } = validatePhone(record.phone, "Ukraine");

    const address = normalizeAddress(record.address);
    const brands = [];
    const geo = buildGeo({
        city: record.city,
        country: "Ukraine",
        coords: record.coords,
    });

    const now = new Date();

    return {
        ownerUid: null,
        name: record.name,
        nameNormalized: normalizeShowroomName(record.name),
        type,
        availability,
        category: null,
        categoryGroup: null,
        subcategories: [],
        brands,
        brandsNormalized: normalizeBrands(brands),
        brandsMap: buildBrandsMap(brands),
        address,
        addressNormalized: normalizeAddressForCompare(address),
        country: "Ukraine",
        city: record.city,
        geo,
        contacts: {
            phone,
            instagram,
        },
        location: record.coords,
        status: "approved",
        editCount: existing?.editCount ?? 0,
        editHistory: Array.isArray(existing?.editHistory) ? existing.editHistory : [],
        submittedAt: existing?.submittedAt ?? null,
        reviewedAt: existing?.reviewedAt ?? null,
        reviewedBy: existing?.reviewedBy ?? null,
        reviewReason: null,
        pendingSnapshot: null,
        source: "starter",
        seedSource: "store_workbook",
        seedFile: "База для стора.xlsx",
        seedKey: record.id,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };
}

function assertUniqueIds(records) {
    const ids = new Set();
    for (const record of records) {
        if (ids.has(record.id)) throw new Error(`Duplicate starter showroom id: ${record.id}`);
        ids.add(record.id);
    }
}

async function main() {
    assertUniqueIds(STARTER_SHOWROOMS);

    const db = getFirestoreInstance();
    const summary = {
        env: ENV,
        dryRun,
        total: STARTER_SHOWROOMS.length,
        created: 0,
        updated: 0,
        showrooms: [],
    };

    let batch = db.batch();
    let writes = 0;

    for (const record of STARTER_SHOWROOMS) {
        const ref = db.collection("showrooms").doc(record.id);
        const snap = await ref.get();
        const doc = buildDoc(record, snap.exists ? snap.data() : null);
        const action = snap.exists ? "updated" : "created";

        summary[action] += 1;
        summary.showrooms.push({
            id: record.id,
            action,
            name: doc.name,
            type: doc.type,
            availability: doc.availability,
            address: doc.address,
            city: doc.city,
            coords: doc.geo.coords,
            geohash: doc.geo.geohash,
            instagram: doc.contacts.instagram,
            phone: doc.contacts.phone,
        });

        if (!dryRun) {
            batch.set(ref, doc, { merge: true });
            writes += 1;
            if (writes >= 400) {
                await batch.commit();
                batch = db.batch();
                writes = 0;
            }
        }
    }

    if (!dryRun && writes > 0) {
        await batch.commit();
    }

    console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
