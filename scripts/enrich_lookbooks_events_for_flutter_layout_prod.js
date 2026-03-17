import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const ENV = process.env.NODE_ENV || "dev";
if (ENV !== "prod") {
    console.error("Refusing to run: NODE_ENV must be 'prod'.");
    process.exit(1);
}

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const force = process.env.CONFIRM_PROD_ENRICH === "YES";

if (execute && !force) {
    console.error("Refusing to execute in prod without CONFIRM_PROD_ENRICH=YES.");
    process.exit(1);
}

const LOOKBOOK_LIMIT = 10;
const EVENT_LIMIT = 6;
const ITEM_COUNT = 15;
const PUBLIC_URL = "https://www.instagram.com/dim_brendiv/";

function toMillis(value) {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

function buildLongDescription(kind, title, city, country) {
    const paragraphs = [
        `${title} is used as a deliberate long-form ${kind} description for Flutter layout verification in ${city || "the selected city"}, ${country || "the selected country"}.`,
        "The text intentionally contains several sentences of different lengths so the mobile client can verify line wrapping, paragraph spacing, truncation rules, and full-detail rendering without relying on synthetic lorem ipsum.",
        "This content should help QA validate typography, vertical rhythm, long-card behaviour, detail screen overflow, and how the interface behaves when editorial text becomes noticeably longer than standard MVP seed content.",
        "It also gives the team a stable fixture for regression checks after future UI refactors, especially in places where buttons, external links, and image blocks must coexist with a large amount of descriptive copy.",
        "If the design introduces expandable text, fade-out masks, read-more buttons, or dynamic-height containers, this fixture should make those behaviours visible immediately during manual testing.",
    ];

    let text = paragraphs.join(" ");
    while (text.length < 980) {
        text += ` ${paragraphs[text.length % paragraphs.length]}`;
    }
    return text.slice(0, 1000).trim();
}

function buildLookbookItems() {
    const base = [
        ["coat", "Coat", "DIM Brendiv"],
        ["blazer", "Blazer", "DIM Brendiv"],
        ["shirt", "Shirt", "DIM Brendiv"],
        ["top", "Top", "DIM Brendiv"],
        ["trousers", "Trousers", "DIM Brendiv"],
        ["jeans", "Jeans", "DIM Brendiv"],
        ["skirt", "Skirt", "DIM Brendiv"],
        ["dress", "Dress", "DIM Brendiv"],
        ["cardigan", "Cardigan", "DIM Brendiv"],
        ["coat_belt", "Belt", "DIM Brendiv"],
        ["bag", "Bag", "DIM Brendiv"],
        ["boots", "Boots", "DIM Brendiv"],
        ["shoes", "Shoes", "DIM Brendiv"],
        ["scarf", "Scarf", "DIM Brendiv"],
        ["jewelry", "Jewelry", "DIM Brendiv"],
    ];

    return base.slice(0, ITEM_COUNT).map(([nameKey, name, brand], index) => ({
        nameKey,
        name,
        brand,
        link: `${PUBLIC_URL}?item=${index + 1}`,
    }));
}

function chooseLookbooks(docs) {
    return docs
        .filter(doc => doc.data()?.published === true)
        .sort((a, b) => toMillis(b.data()?.publishedAt) - toMillis(a.data()?.publishedAt))
        .slice(0, LOOKBOOK_LIMIT);
}

function chooseEvents(docs) {
    const now = Date.now();
    return docs
        .filter(doc => doc.data()?.published === true)
        .filter(doc => toMillis(doc.data()?.startsAt) >= now)
        .sort((a, b) => toMillis(a.data()?.startsAt) - toMillis(b.data()?.startsAt))
        .slice(0, EVENT_LIMIT);
}

async function commitInBatches(db, operations) {
    let batch = db.batch();
    let ops = 0;
    for (const operation of operations) {
        operation(batch);
        ops += 1;
        if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }
    if (ops > 0) {
        await batch.commit();
    }
}

async function main() {
    initFirebase();
    const db = getFirestoreInstance();

    const [lookbooksSnap, eventsSnap] = await Promise.all([
        db.collection("lookbooks").get(),
        db.collection("events").get(),
    ]);

    const targetLookbooks = chooseLookbooks(lookbooksSnap.docs);
    const targetEvents = chooseEvents(eventsSnap.docs);
    const nowTs = Timestamp.fromDate(new Date());

    const lookbookOperations = targetLookbooks.map(doc => {
        const data = doc.data() || {};
        const patch = {
            description: buildLongDescription("lookbook", data.title || data.name || doc.id, data.city, data.country),
            items: buildLookbookItems(),
            updatedAt: nowTs,
        };

        return {
            id: doc.id,
            title: data.title || data.name || null,
            op: batch => batch.set(doc.ref, patch, { merge: true }),
        };
    });

    const eventOperations = targetEvents.map(doc => {
        const data = doc.data() || {};
        const patch = {
            description: buildLongDescription("event", data.name || doc.id, data.city, data.country),
            updatedAt: nowTs,
        };

        return {
            id: doc.id,
            title: data.name || null,
            op: batch => batch.set(doc.ref, patch, { merge: true }),
        };
    });

    const summary = {
        execute,
        lookbooks: {
            targeted: lookbookOperations.length,
            ids: lookbookOperations.map(item => ({ id: item.id, title: item.title })),
            itemCount: ITEM_COUNT,
        },
        events: {
            targeted: eventOperations.length,
            ids: eventOperations.map(item => ({ id: item.id, title: item.title })),
        },
    };

    if (!execute) {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }

    await commitInBatches(db, lookbookOperations.map(item => item.op));
    await commitInBatches(db, eventOperations.map(item => item.op));

    console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
