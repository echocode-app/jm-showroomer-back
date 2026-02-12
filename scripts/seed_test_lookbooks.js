import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestoreInstance } from "../src/config/firebase.js";

const ENV = process.env.NODE_ENV || "dev";
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

try {
    await fs.access(envFile);
    dotenv.config({ path: envFile });
} catch {
    // allow runtime env only
}

const db = getFirestoreInstance();
const prefix = process.argv[2] || `lookbook_${Date.now()}`;

const now = new Date();
const tsDaysAgo = n => Timestamp.fromDate(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));

const docs = {
    [`${prefix}_ua_ss_rank_1`]: {
        title: `UA SS Ranked 1 ${prefix}`,
        description: "Seeded lookbook",
        country: "Ukraine",
        countryNormalized: "ukraine",
        city: "Kyiv",
        cityNormalized: "kyiv",
        seasonLabel: "SS 2026",
        seasonKey: "ss-2026",
        coverPath: `lookbooks/${prefix}_ua_ss_rank_1/cover/cover.webp`,
        images: [
            { storagePath: `lookbooks/${prefix}_ua_ss_rank_1/pages/1.webp`, order: 1 },
            { storagePath: `lookbooks/${prefix}_ua_ss_rank_1/pages/2.webp`, order: 2 },
        ],
        sortRank: 1,
        published: true,
        publishedAt: tsDaysAgo(1),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        source: "seed",
    },
    [`${prefix}_ua_ss_rank_2`]: {
        title: `UA SS Ranked 2 ${prefix}`,
        description: "Seeded lookbook",
        country: "Ukraine",
        countryNormalized: "ukraine",
        city: "Lviv",
        cityNormalized: "lviv",
        seasonLabel: "SS 2026",
        seasonKey: "ss-2026",
        coverPath: `lookbooks/${prefix}_ua_ss_rank_2/cover/cover.webp`,
        images: [
            { storagePath: `lookbooks/${prefix}_ua_ss_rank_2/pages/1.webp`, order: 1 },
        ],
        sortRank: 2,
        published: true,
        publishedAt: tsDaysAgo(2),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        source: "seed",
    },
    [`${prefix}_ua_ss_unranked_1`]: {
        title: `UA SS Unranked ${prefix}`,
        description: "Seeded lookbook",
        country: "Ukraine",
        countryNormalized: "ukraine",
        city: "Odesa",
        cityNormalized: "odesa",
        seasonLabel: "SS 2026",
        seasonKey: "ss-2026",
        coverPath: `lookbooks/${prefix}_ua_ss_unranked_1/cover/cover.webp`,
        images: [
            { storagePath: `lookbooks/${prefix}_ua_ss_unranked_1/pages/1.webp`, order: 1 },
        ],
        sortRank: null,
        published: true,
        publishedAt: tsDaysAgo(3),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        source: "seed",
    },
    [`${prefix}_ua_fw_1`]: {
        title: `UA FW ${prefix}`,
        country: "Ukraine",
        countryNormalized: "ukraine",
        seasonLabel: "FW 2026",
        seasonKey: "fw-2026",
        coverPath: `lookbooks/${prefix}_ua_fw_1/cover/cover.webp`,
        images: [
            { storagePath: `lookbooks/${prefix}_ua_fw_1/pages/1.webp`, order: 1 },
        ],
        published: true,
        publishedAt: tsDaysAgo(1),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        source: "seed",
    },
    [`${prefix}_pl_ss_1`]: {
        title: `PL SS ${prefix}`,
        country: "Poland",
        countryNormalized: "poland",
        seasonLabel: "SS 2026",
        seasonKey: "ss-2026",
        coverPath: `lookbooks/${prefix}_pl_ss_1/cover/cover.webp`,
        images: [
            { storagePath: `lookbooks/${prefix}_pl_ss_1/pages/1.webp`, order: 1 },
        ],
        published: true,
        publishedAt: tsDaysAgo(1),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        source: "seed",
    },
    [`${prefix}_ua_ss_hidden_1`]: {
        title: `UA SS Hidden ${prefix}`,
        country: "Ukraine",
        countryNormalized: "ukraine",
        seasonLabel: "SS 2026",
        seasonKey: "ss-2026",
        coverPath: `lookbooks/${prefix}_ua_ss_hidden_1/cover/cover.webp`,
        images: [
            { storagePath: `lookbooks/${prefix}_ua_ss_hidden_1/pages/1.webp`, order: 1 },
        ],
        published: false,
        publishedAt: tsDaysAgo(1),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        source: "seed",
    },
};

await Promise.all(
    Object.entries(docs).map(([id, data]) =>
        db.collection("lookbooks").doc(id).set(data, { merge: true })
    )
);

console.log(
    JSON.stringify({
        prefix,
        ranked1Id: `${prefix}_ua_ss_rank_1`,
        ranked2Id: `${prefix}_ua_ss_rank_2`,
        unrankedId: `${prefix}_ua_ss_unranked_1`,
        otherSeasonId: `${prefix}_ua_fw_1`,
        otherCountryId: `${prefix}_pl_ss_1`,
        hiddenId: `${prefix}_ua_ss_hidden_1`,
    })
);
