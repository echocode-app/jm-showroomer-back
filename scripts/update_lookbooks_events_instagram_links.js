import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
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
const execute = args.has("--execute");
const urlArg = process.argv.find(arg => arg.startsWith("--url="));
const targetUrl = urlArg
    ? urlArg.slice("--url=".length)
    : "https://www.instagram.com/dim_brendiv/";

const db = getFirestoreInstance();

async function updateLookbooks() {
    const snap = await db.collection("lookbooks").get();
    let scanned = 0;
    let updated = 0;

    for (const doc of snap.docs) {
        scanned += 1;
        const data = doc.data() || {};
        const patch = {};

        if (data?.author && typeof data.author === "object" && data.author.instagram) {
            patch.author = {
                ...data.author,
                instagram: targetUrl,
            };
        }

        if (typeof data.authorInstagram === "string" && data.authorInstagram.trim()) {
            patch.authorInstagram = targetUrl;
        }

        if (Array.isArray(data.items) && data.items.length > 0) {
            patch.items = data.items.map(item => {
                if (!item || typeof item !== "object") return item;
                if (!item.link) return item;
                return {
                    ...item,
                    link: targetUrl,
                };
            });
        }

        if (Object.keys(patch).length === 0) continue;
        updated += 1;
        if (execute) {
            await doc.ref.set(patch, { merge: true });
        }
    }

    return { scanned, updated };
}

async function updateEvents() {
    const snap = await db.collection("events").get();
    let scanned = 0;
    let updated = 0;

    for (const doc of snap.docs) {
        scanned += 1;
        const data = doc.data() || {};
        if (!data.externalUrl) continue;
        updated += 1;
        if (execute) {
            await doc.ref.set({ externalUrl: targetUrl }, { merge: true });
        }
    }

    return { scanned, updated };
}

const lookbooks = await updateLookbooks();
const events = await updateEvents();

console.log(JSON.stringify({
    execute,
    targetUrl,
    lookbooks,
    events,
}, null, 2));
