import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import dotenv from "dotenv";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../src/config/firebase.js";
import { MEDIA_POLICY } from "../src/constants/mediaPolicy.js";
import { normalizeCountry } from "../src/constants/countries.js";
import { normalizeCity } from "../src/utils/geoValidation.js";

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
    console.error("Refusing to seed production starter events without --allow-prod");
    process.exit(1);
}

const defaultImagesDir = path.join(os.homedir(), "Downloads", "Ивенты база");
const imagesDir = readArgValue(argv, "--images-dir") || process.env.STARTER_EVENT_IMAGES_DIR || defaultImagesDir;
const convertedDir = path.join(os.tmpdir(), "jm-showroomer-starter-events");

// Starter event records are real launch content from the store workbook, not mock fixtures.
const STARTER_EVENTS = [
    {
        id: "starter_event_001_ukrainian_fashion_week_ss27",
        country: "Ukraine",
        city: "Kyiv",
        name: "Ukrainian Fashion Week SS27",
        dateRange: "03.09.2026 – 06.09.2026",
        address: "м. Київ, вул. Лаврська, 10-12 (Мистецький Арсенал)",
        description: "Головна модна подія України. Презентація нових колекцій українських дизайнерів сезону Весна/Літо 2027, панельні дискусії про розвиток індустрії та інсайд-презентації.",
        type: "fashion_week",
    },
    {
        id: "starter_event_002_paris_fashion_week_womens_ss27",
        country: "France",
        city: "Paris",
        name: "Paris Fashion Week (Women's SS27)",
        dateRange: "28.09.2026 – 06.10.2026",
        address: "м. Париж, Palais de Tokyo та інші локації",
        description: "Паризький тиждень моди. Покази провідних світових будинків високої моди та готового одягу (Ready-to-Wear), які задають тренди на весь наступний рік.",
        type: "fashion_week",
    },
    {
        id: "starter_event_003_mercedes_benz_fashion_week_madrid",
        country: "Spain",
        city: "Madrid",
        name: "Mercedes-Benz Fashion Week Madrid",
        dateRange: "10.09.2026 – 13.09.2026",
        address: "м. Мадрид, експоцентр IFEMA (Avenida del Partenón, 5)",
        description: "Ключова подія іспанської індустрії моди, що презентує найкращих локальних дизайнерів, бренд-амбасадорів та концептуальне мистецтво.",
        type: "fashion_week",
    },
    {
        id: "starter_event_004_kvartyrnyk_design_art_market",
        country: "Ukraine",
        city: "Kyiv",
        name: "КВАРТИРНИК: Дизайн та Арт Маркет",
        dateRange: "18.07.2026 – 19.07.2026",
        address: "м. Київ, вул. Михайлівська, 24А",
        description: "Камерний маркет локальних українських брендів одягу, прикрас, апсайклінг-речей та кераміки з благодійною метою та живими сетами локальних діджеїв.",
        type: "market",
    },
    {
        id: "starter_event_005_premiere_vision_paris_2027",
        country: "France",
        city: "Paris",
        name: "Première Vision Paris 2027",
        dateRange: "02.02.2027 – 04.02.2027",
        address: "м. Париж, Parc des Expositions de Villepinte",
        description: "Найбільша міжнародна виставка текстилю, еко-тканин, пряжі та фурнітури. Головне місце зустрічі дизайнерів та виробників одягу для планування майбутніх колекцій.",
        type: "trade_show",
    },
    {
        id: "starter_event_006_080_barcelona_fashion",
        country: "Spain",
        city: "Barcelona",
        name: "080 Barcelona Fashion",
        dateRange: "20.10.2026 – 23.10.2026",
        address: "м. Барселона, Recinte Modernista de Sant Pau",
        description: "Модна платформа Барселони, яка робить акцент на сталій моді (sustainable fashion), інклюзивності та використанні цифрових технологій у дизайні одягу.",
        type: "fashion_week",
    },
    {
        id: "starter_event_007_lviv_fashion_week",
        country: "Ukraine",
        city: "Lviv",
        name: "Lviv Fashion Week",
        dateRange: "16.10.2026 – 18.10.2026",
        address: "м. Львів, вул. Старознесенська, 24-26 (!FESTrepublic)",
        description: "Львівський тиждень моди. Покази нових лінійок від дизайнерів Західної України, освітні лекторії про бренд-менеджмент та відкриті тимчасові шоуруми.",
        type: "fashion_week",
    },
    {
        id: "starter_event_008_cannes_shopping_festival_2027",
        country: "France",
        city: "Cannes",
        name: "Cannes Shopping Festival 2027",
        dateRange: "16.04.2027 – 19.04.2027",
        address: "м. Канни, Palais des Festivals (Boulevard de la Croisette)",
        description: "Чотири дні яскравих модних показів, закритих VIP-коктейлів, шопінг-подій та гала-вечорів на знаменитому Лазуровому уверезі Франції.",
        type: "festival",
    },
    {
        id: "starter_event_009_barcelona_bridal_fashion_week_2027",
        country: "Spain",
        city: "Barcelona",
        name: "Barcelona Bridal Fashion Week 2027",
        dateRange: "21.04.2027 – 25.04.2027",
        address: "м. Барселона, експоцентр Fira Barcelona (Montjuïc)",
        description: "Провідна світова подія весільної моди. Грандіозні покази весільних та вечірніх суконь від преміальних кутюр'є, а також масштабний B2B трейд-шоу.",
        type: "fashion_week",
    },
    {
        id: "starter_event_010_kyiv_fashion_2026_autumn",
        country: "Ukraine",
        city: "Kyiv",
        name: "Kyiv Fashion 2026 (Осінь)",
        dateRange: "09.09.2026 – 11.09.2026",
        address: "м. Київ, Броварський проспект, 15 (МВЦ)",
        description: "Найбільша в Україні B2B виставка текстильної промисловості: готові вироби, дистриб'ютори тканин, обладнання для швейного бізнесу та нетворкінг.",
        type: "trade_show",
    },
];

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
if (!storageBucket) {
    throw new Error("FIREBASE_STORAGE_BUCKET is not configured");
}

let storageAccessToken = null;
let storageAccessTokenExpiresAt = 0;

function readArgValue(values, flag) {
    const direct = values.find(arg => arg.startsWith(`${flag}=`));
    if (direct) return direct.slice(flag.length + 1) || null;
    const idx = values.indexOf(flag);
    if (idx < 0) return null;
    return values[idx + 1] || null;
}

function compareNaturalFiles(left, right) {
    return left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
    });
}

async function listImageFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
        .filter(name => [".avif", ".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(name).toLowerCase()))
        .sort(compareNaturalFiles);
}

function contentTypeForExt(ext) {
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    return null;
}

async function prepareImageForUpload(localPath, id) {
    let ext = path.extname(localPath).toLowerCase();
    let uploadPath = localPath;

    if (ext === ".avif") {
        await fs.mkdir(convertedDir, { recursive: true });
        uploadPath = path.join(convertedDir, `${id}.jpg`);
        execFileSync("sips", ["-s", "format", "jpeg", localPath, "--out", uploadPath], { stdio: "ignore" });
        ext = ".jpg";
    }

    if (!MEDIA_POLICY.allowedExtensionsNow.includes(ext)) {
        throw new Error(`Unsupported image extension for ${localPath}: ${ext}`);
    }

    const stat = await fs.stat(uploadPath);
    const maxBytes = MEDIA_POLICY.perKindLimits.cover.maxBytes;
    if (stat.size > maxBytes) {
        throw new Error(`Image too large for ${localPath}: ${stat.size} bytes`);
    }

    return {
        uploadPath,
        ext,
        contentType: contentTypeForExt(ext),
        originalFilename: path.basename(localPath),
        uploadedFilename: `${id}${ext}`,
        converted: uploadPath !== localPath,
        bytes: stat.size,
    };
}

async function uploadIfNeeded(localPath, storagePath, contentType) {
    if (dryRun) return;
    await withRetry(async () => {
        const file = await fs.readFile(localPath);
        const token = await getStorageAccessToken();
        const boundary = `jm_showroomer_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const metadata = Buffer.from(JSON.stringify({
            name: storagePath,
            contentType,
            cacheControl: "public, max-age=3600",
        }));
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
            metadata,
            Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
            file,
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(storageBucket)}/o?uploadType=multipart`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Storage upload failed for ${storagePath}: ${res.status} ${text}`);
        }
    }, `upload ${storagePath}`);
}

async function getStorageAccessToken() {
    if (storageAccessToken && Date.now() < storageAccessTokenExpiresAt - 60_000) {
        return storageAccessToken;
    }

    const email = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!email || !privateKey) {
        throw new Error("Firebase service account credentials are not configured");
    }

    const iat = Math.floor(Date.now() / 1000);
    const assertionHead = [
        base64UrlJson({ alg: "RS256", typ: "JWT" }),
        base64UrlJson({
            iss: email,
            scope: "https://www.googleapis.com/auth/devstorage.full_control",
            aud: "https://oauth2.googleapis.com/token",
            iat,
            exp: iat + 3600,
        }),
    ].join(".");
    const signature = crypto
        .sign("RSA-SHA256", Buffer.from(assertionHead), privateKey)
        .toString("base64url");
    const assertion = `${assertionHead}.${signature}`;
    const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.access_token) {
        throw new Error(`Failed to resolve Google Storage access token: ${res.status} ${JSON.stringify(json)}`);
    }

    storageAccessToken = json.access_token;
    storageAccessTokenExpiresAt = Date.now() + Number(json.expires_in ?? 3600) * 1000;
    return storageAccessToken;
}

function base64UrlJson(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function withRetry(fn, label, attempts = 4) {
    let lastErr = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt === attempts) break;
            const delayMs = 750 * attempt;
            console.warn(`[starter-events] retry ${attempt}/${attempts - 1} for ${label}: ${err?.message || err}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastErr;
}

function parseDateRange(value) {
    const parts = String(value || "")
        .split(/\s+[–-]\s+/u)
        .map(part => part.trim())
        .filter(Boolean);
    if (parts.length < 1 || parts.length > 2) {
        throw new Error(`Invalid event date range: ${value}`);
    }

    return {
        startsAt: Timestamp.fromDate(parseDate(parts[0], 9)),
        endsAt: Timestamp.fromDate(parseDate(parts[1] ?? parts[0], 18)),
    };
}

function parseDate(value, hourUtc) {
    const match = String(value || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) throw new Error(`Invalid event date: ${value}`);
    const [, day, month, year] = match;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hourUtc, 0, 0));
}

function buildDoc(record, image, existing = null) {
    const now = Timestamp.fromDate(new Date());
    const { startsAt, endsAt } = parseDateRange(record.dateRange);
    const coverPath = `events/${record.id}/cover/${image.uploadedFilename}`;

    return {
        name: record.name,
        description: record.description,
        type: record.type,
        country: record.country,
        countryNormalized: normalizeCountry(record.country),
        city: record.city,
        cityNormalized: normalizeCity(record.city),
        address: record.address,
        externalUrl: null,
        startsAt,
        endsAt,
        coverPath,
        assets: [
            {
                kind: "cover",
                path: coverPath,
                storagePath: coverPath,
                type: "image",
                order: 1,
                meta: {
                    originalFilename: image.originalFilename,
                    converted: image.converted,
                },
            },
        ],
        imageSource: {
            originalFilename: image.originalFilename,
            converted: image.converted,
        },
        source: "starter",
        seedSource: "store_workbook",
        seedFile: "База для стора.xlsx",
        seedKey: record.id,
        published: true,
        status: "published",
        wantToVisitCount: existing?.wantToVisitCount ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };
}

async function main() {
    if (!dryRun) {
        await withRetry(() => getStorageAccessToken(), "prefetch storage token");
    }

    const db = getFirestoreInstance();
    const files = await listImageFiles(imagesDir);
    if (files.length < STARTER_EVENTS.length) {
        throw new Error(`Not enough event images: expected ${STARTER_EVENTS.length}, got ${files.length}`);
    }

    const summary = {
        env: ENV,
        dryRun,
        imagesDir,
        total: STARTER_EVENTS.length,
        created: 0,
        updated: 0,
        unusedImages: files.slice(STARTER_EVENTS.length),
        events: [],
    };

    let batch = db.batch();
    let writes = 0;

    for (let index = 0; index < STARTER_EVENTS.length; index += 1) {
        const record = STARTER_EVENTS[index];
        const localPath = path.join(imagesDir, files[index]);
        const image = await prepareImageForUpload(localPath, record.id);
        const ref = db.collection("events").doc(record.id);
        const snap = await ref.get();
        const doc = buildDoc(record, image, snap.exists ? snap.data() : null);
        const action = snap.exists ? "updated" : "created";

        await uploadIfNeeded(image.uploadPath, doc.coverPath, image.contentType);

        summary[action] += 1;
        summary.events.push({
            id: record.id,
            action,
            row: index + 1,
            image: image.originalFilename,
            converted: image.converted,
            name: doc.name,
            country: doc.country,
            city: doc.city,
            startsAt: doc.startsAt.toDate().toISOString(),
            endsAt: doc.endsAt.toDate().toISOString(),
            coverPath: doc.coverPath,
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
