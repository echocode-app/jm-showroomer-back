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
    console.error("Refusing to seed production starter lookbooks without --allow-prod");
    process.exit(1);
}

const defaultImagesDir = path.join(os.homedir(), "Downloads", "Лукбуки база");
const imagesDir = readArgValue(argv, "--images-dir") || process.env.STARTER_LOOKBOOK_IMAGES_DIR || defaultImagesDir;
const convertedDir = path.join(os.tmpdir(), "jm-showroomer-starter-lookbooks");
const STARTER_LOOKBOOK_SEASON = {
    key: "summer",
    label: "Summer",
};

// Starter lookbook records are real launch content from the store workbook, not mock fixtures.
const STARTER_LOOKBOOKS = [
    {
        id: "starter_lookbook_001",
        title: "Lookbook 01",
        country: "Ukraine",
        itemsRaw: "сукня-https://answear.ua/p/haveone-litnya-suknya-bezheva-odnotonna-ama-q047-1806011\nсандалі-https://answear.ua/p/sandali-steve-madden-bryanna-kolir-zolotyj-sm11002613-1000868",
    },
    {
        id: "starter_lookbook_002",
        title: "Lookbook 02",
        country: "Ukraine",
        itemsRaw: "сорочка-https://answear.ua/p/polo-ralph-lauren-polo-zhinoche-bavovnyane-wimbledon-bile-211b16029-1760317\nспідниця-https://answear.ua/p/spidnytsya-adidas-originals-kolir-bezhevyj-mini-rozkloshena-kc9095-1722198\nкепка-https://answear.ua/p/allsaints-kepka-dzhynsova-blakytna-29w215xe-1738410",
    },
    {
        id: "starter_lookbook_003",
        title: "Lookbook 03",
        country: "Ukraine",
        itemsRaw: "куртка-https://answear.ua/p/vicolo-korotka-kurtka-zhinocha-shkiryana-bezheva-tab0174-1790729\nфутболка-https://answear.ua/p/u-s-polo-assn-futbolka-zhinocha-bavovnyane-stripe-crew-neck-temno-synya-wup1308-1717350\nштани-https://answear.ua/p/boss-shtany-loungwear-zhinochi-cp-stripe-pants-cuff-bezhevi-high-waist-50524759-1272897\nсандалі-https://answear.ua/p/shkiryani-sandali-michael-michael-kors-liana-sandal-kolir-bilyj-40r6lnhs1l-085-1694754",
    },
    {
        id: "starter_lookbook_004",
        title: "Lookbook 04",
        country: "Ukraine",
        itemsRaw: "желет-https://answear.ua/p/answear-lab-komplekt-zhinochyj-z-domishkoyu-lonu-chornyj-1739476\nштани-https://answear.ua/p/zhylet-ta-shtany-answear-lab-kolir-chornyj-1558413\nтуфлі-https://answear.ua/p/michael-michael-kors-vzuttya-na-shpyltsi-shkiryane-elyse-high-pump-bezheve-40f5eyhp1l-297-1765304",
    },
    {
        id: "starter_lookbook_005",
        title: "Lookbook 05",
        country: "Ukraine",
        itemsRaw: "футболка-https://answear.ua/p/polo-ralph-lauren-futbolka-basic-zhinocha-bavovnyana-vntg-ctn-jsy-knt-t-shirt-blakytna-211a12734001-1763843\nшорти-https://answear.ua/p/patrizia-pepe-shorty-zhinochi-dzhynsovi-bili-2p1744-d107-1741874\nшльопанці-https://answear.ua/p/vagabond-shoemakers-shlopantsi-zhinochi-shkiryani-izzy-chorni-5913-401-20-1805509",
    },
    {
        id: "starter_lookbook_006",
        title: "Lookbook 06",
        country: "Ukraine",
        itemsRaw: "куртка-https://answear.ua/p/adidas-originals-kurtka-zhinocha-chorna-kv1187-1758841\nштани-https://answear.ua/p/sportyvni-shtany-guess-nat-kolir-chornyj-odnotonni-v6rb15-k9v31-1714443\nфутболка-https://answear.ua/p/guess-futbolka-zhinocha-bavovnyana-z-elastanom-colette-bezheva-v4yi09-j1314-1413545\nв'єтнамки-https://answear.ua/p/vagabond-shoemakers-vietnamky-zhinochi-shkiryani-izzy-korychnevi-5913-401-35-1737916",
    },
    {
        id: "starter_lookbook_007",
        title: "Lookbook 07",
        country: "Ukraine",
        itemsRaw: "сорочка-https://answear.ua/p/sorochka-z-lonu-answear-lab-regular-klasychnyj-komir-1530718\nшорти-https://answear.ua/p/united-colors-of-benetton-shorty-zhinochi-llyani-bezhevi-high-waist-4aghd901v-1774521\nшльопанці-https://answear.ua/p/pinko-shlopantsi-zhinochi-shkiryani-milly-04-bezhevi-sd0463p001z12-1741618",
    },
    {
        id: "starter_lookbook_008",
        title: "Lookbook 08",
        country: "Ukraine",
        itemsRaw: "рубашка-https://modivo.ua/p/juicy-couture-sorochka-dog-crest-jcypt126861-rozhevii-relaxed-fit-0000305964571\nфутболка-https://modivo.ua/p/robe-di-kappa-futbolka-katie-62115rw-bilii-regular-fit-0000305246110\nшорти-https://modivo.ua/p/juicy-couture-sportivni-shorti-tamia-jcwhs126305-rozhevii-regular-fit-0000305964519",
    },
    {
        id: "starter_lookbook_009",
        title: "Lookbook 09",
        country: "Ukraine",
        itemsRaw: "сукня-https://modivo.ua/p/michael-michael-kors-litnia-suknia-ms683hikr1-bilii-slim-fit-0000306079724?snrai_campaign=G6lbOrdNjs9y&snrai_id=160628e1-7717-4ff8-b979-f62305762457\nбосоніжки-https://modivo.ua/p/crocs-bosonizhki-miami-thong-flip-209793-korichnevii-0000305353610\nпанама-https://modivo.ua/p/juicy-couture-kapeliukh-bot-bucket-jcawh125711-rozhevii-0000305033031",
    },
    {
        id: "starter_lookbook_010",
        title: "Lookbook 10",
        country: "Ukraine",
        itemsRaw: "футболка-https://modivo.ua/p/guess-futbolka-v6ri17-kd741-cinii-regular-fit-0000305718907?snrai_campaign=G6lbOrdNjs9y&snrai_id=a82f7721-cb39-47d8-9c0b-0186b32246cb\nджинси-https://modivo.ua/p/boss-dzhinsi-c-marlene-hr-11-0-50555871-golubii-regular-fit-0000305670915\nкросівки-https://modivo.ua/p/boss-krosivki-morrie-slon-rnmono-50541649-bilii-0000304958533",
    },
    {
        id: "starter_lookbook_011",
        title: "Lookbook 11",
        country: "Ukraine",
        itemsRaw: "майка-https://modivo.ua/p/juicy-couture-top-thin-strap-jcwlv126308-bilii-slim-fit-0000305964533?snrai_campaign=dYPgRf3EhjAZ&snrai_id=42d979fd-ebea-4c60-9586-51779d057c01\nштани-https://modivo.ua/p/adidas-sportivni-shtani-essentials-fleece-iy9638-sirii-loose-fit-0000304497957",
    },
    {
        id: "starter_lookbook_012",
        title: "Lookbook 12",
        country: "Ukraine",
        itemsRaw: "футболка-https://modivo.ua/p/reebok-futbolka-rk25315ccw-bezhevii-regular-fit-0000305629388?snrai_campaign=G6lbOrdNjs9y&snrai_id=80c1d57f-25d4-4080-be31-9517d906bd4f\nшорти-https://modivo.ua/p/reebok-sportivni-shorti-jacqueline-rk25500ccw-bezhevii-regular-fit-0000305908711\nкросівки-https://modivo.ua/p/juicy-couture-krosivki-vsju001-bilii-5906751118832",
    },
    {
        id: "starter_lookbook_013",
        title: "Lookbook 13",
        country: "Ukraine",
        itemsRaw: "сукня-https://modivo.ua/p/guess-jeans-povsiakdenna-suknia-179918-bilii-classic-fit-0000305720078\nкросівки-https://modivo.ua/p/gant-krosivki-32538309-bilii-0000305874078",
    },
    {
        id: "starter_lookbook_014",
        title: "Lookbook 14",
        country: "Ukraine",
        itemsRaw: "сукня-сорочка-https://modivo.ua/p/polo-ralph-lauren-suknia-sorochka-211968897001-bilii-regular-fit-0000305936615\nшльопанці-https://modivo.ua/p/polo-ralph-lauren-shlopantsi-polo-bear-slide-809p09762001-bilii-0000305919236?snrai_campaign=YS3Tla7ngk8Y&snrai_id=092d771e-989b-4dee-be4e-1c43797f6687",
    },
    {
        id: "starter_lookbook_015",
        title: "Lookbook 15",
        country: "Ukraine",
        itemsRaw: "поло-https://modivo.ua/p/beverly-hills-polo-club-polo-p-ss26w-p0300-bezhevii-regular-fit-2230100362830?snrai_campaign=G6lbOrdNjs9y&snrai_id=e851a2f6-4431-4c83-b120-a20229d8e43d\nджинси-https://modivo.ua/p/adidas-dzhinsi-firebird-adilenium-kd2905-chornii-wide-leg-0000305783868\nтуфлі-https://modivo.ua/p/lasocki-tufli-ceo-wb-rosa-sh-01-chornii-5906751984659",
    },
];

const ITEM_NAME_KEYS = new Map([
    ["босоніжки", "sandals"],
    ["в'єтнамки", "flip_flops"],
    ["джинси", "jeans"],
    ["желет", "vest"],
    ["жилет", "vest"],
    ["кепка", "cap"],
    ["кросівки", "sneakers"],
    ["куртка", "jacket"],
    ["майка", "tank_top"],
    ["панама", "bucket_hat"],
    ["поло", "polo"],
    ["рубашка", "shirt"],
    ["сандалі", "sandals"],
    ["сорочка", "shirt"],
    ["спідниця", "skirt"],
    ["сукня", "dress"],
    ["сукня-сорочка", "shirt_dress"],
    ["туфлі", "shoes"],
    ["футболка", "t_shirt"],
    ["шльопанці", "slides"],
    ["шорти", "shorts"],
    ["штани", "pants"],
]);

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
            console.warn(`[starter-lookbooks] retry ${attempt}/${attempts - 1} for ${label}: ${err?.message || err}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastErr;
}

function parseItems(raw) {
    return String(raw || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const match = line.match(/^(.*)-(?=https?:\/\/)(https?:\/\/.+)$/);
            if (!match) throw new Error(`Invalid lookbook item line: ${line}`);
            const name = match[1].trim();
            const link = match[2].trim();
            return {
                name,
                nameKey: ITEM_NAME_KEYS.get(name.toLowerCase()) ?? null,
                brand: null,
                link,
            };
        });
}

function buildDoc(record, image, existing = null, index) {
    const now = new Date();
    const publishedAt = Timestamp.fromDate(new Date(now.getTime() - index * 60 * 60 * 1000));
    const coverPath = `lookbooks/${record.id}/cover/${image.uploadedFilename}`;
    const pagePath = `lookbooks/${record.id}/pages/1-${image.uploadedFilename}`;
    const countryNormalized = normalizeCountry(record.country);

    return {
        title: record.title,
        name: record.title,
        description: null,
        country: record.country,
        countryNormalized,
        city: null,
        cityNormalized: null,
        geo: null,
        seasonLabel: STARTER_LOOKBOOK_SEASON.label,
        seasonKey: STARTER_LOOKBOOK_SEASON.key,
        sortRank: index + 1,
        coverPath,
        images: [
            { storagePath: pagePath, order: 1 },
        ],
        author: null,
        items: parseItems(record.itemsRaw),
        imageSource: {
            originalFilename: image.originalFilename,
            converted: image.converted,
        },
        source: "starter",
        seedSource: "store_workbook",
        seedFile: "База для стора.xlsx",
        seedKey: record.id,
        likesCount: existing?.likesCount ?? 0,
        published: true,
        publishedAt: existing?.publishedAt ?? publishedAt,
        createdAt: existing?.createdAt ?? Timestamp.fromDate(new Date(now.getTime() - (index + 1) * 60 * 60 * 1000)),
        updatedAt: Timestamp.fromDate(now),
    };
}

async function main() {
    if (!dryRun) {
        await withRetry(() => getStorageAccessToken(), "prefetch storage token");
    }

    const db = getFirestoreInstance();
    const files = await listImageFiles(imagesDir);
    if (files.length < STARTER_LOOKBOOKS.length) {
        throw new Error(`Not enough lookbook images: expected ${STARTER_LOOKBOOKS.length}, got ${files.length}`);
    }

    const summary = {
        env: ENV,
        dryRun,
        imagesDir,
        total: STARTER_LOOKBOOKS.length,
        created: 0,
        updated: 0,
        unusedImages: files.slice(STARTER_LOOKBOOKS.length),
        lookbooks: [],
    };

    let batch = db.batch();
    let writes = 0;

    for (let index = 0; index < STARTER_LOOKBOOKS.length; index += 1) {
        const record = STARTER_LOOKBOOKS[index];
        const localPath = path.join(imagesDir, files[index]);
        const image = await prepareImageForUpload(localPath, record.id);
        const ref = db.collection("lookbooks").doc(record.id);
        const snap = await ref.get();
        const doc = buildDoc(record, image, snap.exists ? snap.data() : null, index);
        const action = snap.exists ? "updated" : "created";

        await uploadIfNeeded(image.uploadPath, doc.coverPath, image.contentType);
        await uploadIfNeeded(image.uploadPath, doc.images[0].storagePath, image.contentType);

        summary[action] += 1;
        summary.lookbooks.push({
            id: record.id,
            action,
            row: index + 1,
            image: image.originalFilename,
            converted: image.converted,
            title: doc.title,
            coverPath: doc.coverPath,
            imagePath: doc.images[0].storagePath,
            items: doc.items.map(item => ({ name: item.name, nameKey: item.nameKey, link: item.link })),
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
