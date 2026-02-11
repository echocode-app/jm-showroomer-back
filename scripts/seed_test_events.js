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
const prefix = process.argv[2] || `evt_${Date.now()}`;

const now = new Date();
const plusDays = n => Timestamp.fromDate(new Date(now.getTime() + n * 24 * 60 * 60 * 1000));
const minusDays = n => Timestamp.fromDate(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));

const docs = {
    [`${prefix}_future_1`]: {
        name: `Future Event 1 ${prefix}`,
        description: "Seeded future event for tests",
        type: "pop_up",
        country: "Ukraine",
        city: "Kyiv",
        address: "Kyiv, Khreshchatyk 1",
        cityNormalized: "kyiv",
        externalUrl: "https://example.com/events/future-1",
        startsAt: plusDays(3),
        endsAt: plusDays(3),
        published: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    },
    [`${prefix}_future_2`]: {
        name: `Future Event 2 ${prefix}`,
        description: "Seeded future event for tests",
        type: "fashion_week",
        country: "Poland",
        city: "Warsaw",
        address: "Warsaw, Main St 2",
        cityNormalized: "warsaw",
        externalUrl: "https://example.com/events/future-2",
        startsAt: plusDays(7),
        endsAt: plusDays(7),
        published: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    },
    [`${prefix}_past_1`]: {
        name: `Past Event ${prefix}`,
        description: "Seeded past event for tests",
        type: "showcase",
        country: "Ukraine",
        city: "Lviv",
        address: "Lviv, Rynok Square 1",
        cityNormalized: "lviv",
        externalUrl: "https://example.com/events/past-1",
        startsAt: minusDays(7),
        endsAt: minusDays(7),
        published: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    },
    [`${prefix}_hidden_1`]: {
        name: `Hidden Event ${prefix}`,
        description: "Seeded unpublished event for tests",
        type: "pop_up",
        country: "Ukraine",
        city: "Kyiv",
        address: "Kyiv, Hidden St 5",
        cityNormalized: "kyiv",
        externalUrl: "https://example.com/events/hidden-1",
        startsAt: plusDays(5),
        endsAt: plusDays(5),
        published: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    },
    [`${prefix}_blocked_1`]: {
        name: `Blocked Country Event ${prefix}`,
        description: "Seeded blocked-country event for tests",
        type: "pop_up",
        country: "Russia",
        city: "Moscow",
        address: "Moscow, Blocked St 9",
        cityNormalized: "moscow",
        externalUrl: "https://example.com/events/blocked-1",
        startsAt: plusDays(4),
        endsAt: plusDays(4),
        published: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    },
};

await Promise.all(
    Object.entries(docs).map(([id, data]) =>
        db.collection("events").doc(id).set(data, { merge: true })
    )
);

console.log(
    JSON.stringify({
        prefix,
        futureId: `${prefix}_future_1`,
        futureId2: `${prefix}_future_2`,
        pastId: `${prefix}_past_1`,
        hiddenId: `${prefix}_hidden_1`,
        blockedId: `${prefix}_blocked_1`,
    })
);
