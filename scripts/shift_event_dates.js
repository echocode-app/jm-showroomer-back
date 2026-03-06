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

const args = new Set(process.argv.slice(2));
const monthsArg = process.argv.find(value => value.startsWith("--months="));
const includePast = args.has("--include-past");
const dryRun = !args.has("--execute");
const allowProd = args.has("--allow-prod");

if (ENV === "prod" && !allowProd) {
    console.error("Refusing to update prod without --allow-prod");
    process.exit(1);
}

const months = Number(monthsArg?.split("=").slice(1).join("=") || 3);
if (!Number.isInteger(months) || months <= 0) {
    console.error("Invalid --months value. Expected positive integer.");
    process.exit(1);
}

const db = getFirestoreInstance();

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value === "string") {
        const ms = Date.parse(value);
        return Number.isNaN(ms) ? null : new Date(ms);
    }
    if (typeof value?._seconds === "number") {
        return new Date(value._seconds * 1000);
    }
    return null;
}

function shiftMonths(date, deltaMonths) {
    const next = new Date(date.getTime());
    next.setMonth(next.getMonth() + deltaMonths);
    return next;
}

async function main() {
    const snap = await db.collection("events").get();
    const now = new Date();
    const candidates = [];

    snap.docs.forEach(doc => {
        const data = doc.data() || {};
        const startsAt = toDate(data.startsAt);
        const endsAt = toDate(data.endsAt);
        if (!startsAt) return;
        if (!includePast && startsAt.getTime() < now.getTime()) return;

        candidates.push({
            ref: doc.ref,
            id: doc.id,
            startsAt,
            endsAt,
            nextStartsAt: shiftMonths(startsAt, months),
            nextEndsAt: endsAt ? shiftMonths(endsAt, months) : null,
        });
    });

    if (!dryRun) {
        for (let i = 0; i < candidates.length; i += 400) {
            const chunk = candidates.slice(i, i + 400);
            const batch = db.batch();
            chunk.forEach(item => {
                const payload = {
                    startsAt: Timestamp.fromDate(item.nextStartsAt),
                    updatedAt: new Date().toISOString(),
                };
                if (item.nextEndsAt) {
                    payload.endsAt = Timestamp.fromDate(item.nextEndsAt);
                }
                batch.update(item.ref, payload);
            });
            await batch.commit();
        }
    }

    console.log(JSON.stringify({
        env: ENV,
        dryRun,
        includePast,
        months,
        updatedCount: candidates.length,
        sample: candidates.slice(0, 20).map(item => ({
            id: item.id,
            startsAt: item.startsAt.toISOString(),
            nextStartsAt: item.nextStartsAt.toISOString(),
            endsAt: item.endsAt ? item.endsAt.toISOString() : null,
            nextEndsAt: item.nextEndsAt ? item.nextEndsAt.toISOString() : null,
        })),
    }, null, 2));
}

main().catch(err => {
    console.error(err?.stack || err);
    process.exit(1);
});
