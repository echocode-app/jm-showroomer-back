import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import {
    deriveAddressNormalized,
    deriveBrandsFields,
    deriveGeoFields,
    deriveNameNormalized,
} from "../src/services/showrooms/derivedFields.js";
import { normalizeAddress, normalizeSubcategories } from "../src/utils/showroomNormalization.js";

const ENV = process.env.NODE_ENV || "dev";
if (ENV !== "prod") {
    console.error("Refusing to run: NODE_ENV must be 'prod'.");
    process.exit(1);
}

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const force = process.env.CONFIRM_PROD_CLEANUP === "YES";

if (execute && !force) {
    console.error("Refusing to execute in prod without CONFIRM_PROD_CLEANUP=YES.");
    process.exit(1);
}

const TEST_PATTERNS = [
    /\bpl qa\b/i,
    /\bua qa\b/i,
    /^test/i,
    /\bnotif\b/i,
    /\bfavorites?\b/i,
    /\bthrowaway\b/i,
    /\bgeo seed\b/i,
    /\blegacy geo test\b/i,
    /\bgeo only\b/i,
    /\badmin delete\b/i,
    /\badmin review updated\b/i,
    /\btotal white\b/i,
    /\bdraft only\b/i,
    /\baddress norm\b/i,
    /\broar\b/i,
    /\bincomplete\b/i,
    /\bshowroom .* mod\b/i,
];

function isSeededShowroom(data = {}) {
    return data?.source === "seed"
        || typeof data?.seedBatch === "string"
        || typeof data?.seedTag === "string";
}

function looksLikeTestShowroom(data = {}) {
    const haystacks = [
        data?.name,
        data?.address,
        data?.contacts?.instagram,
    ].filter(Boolean);

    if (!data?.name || !String(data.name).trim()) {
        return true;
    }

    return haystacks.some(value => TEST_PATTERNS.some(pattern => pattern.test(String(value))));
}

function parseTimestampString(value) {
    if (typeof value !== "string") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Timestamp.fromDate(date);
}

function migrateHistory(history) {
    if (!Array.isArray(history)) return null;
    let changed = false;
    const next = history.map(entry => {
        if (!entry || typeof entry !== "object") return entry;
        const at = parseTimestampString(entry.at);
        if (!at) return entry;
        changed = true;
        return { ...entry, at };
    });
    return changed ? next : null;
}

function isEqualJson(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function buildNormalizationPatch(data = {}) {
    const patch = {};

    if (typeof data?.name === "string" && data.name.trim()) {
        const nameNormalized = deriveNameNormalized(data.name);
        if (data.nameNormalized !== nameNormalized) {
            patch.nameNormalized = nameNormalized;
        }
    }

    if (data.address !== undefined) {
        const normalizedAddress = data.address ? normalizeAddress(data.address) : null;
        const addressNormalized = normalizedAddress ? deriveAddressNormalized(normalizedAddress) : null;

        if ((data.address ?? null) !== normalizedAddress) {
            patch.address = normalizedAddress;
        }
        if ((data.addressNormalized ?? null) !== addressNormalized) {
            patch.addressNormalized = addressNormalized;
        }
    }

    if (Array.isArray(data.brands)) {
        const derived = deriveBrandsFields(data.brands);
        if (!isEqualJson(data.brandsNormalized ?? [], derived.brandsNormalized)) {
            patch.brandsNormalized = derived.brandsNormalized;
        }
        if (!isEqualJson(data.brandsMap ?? {}, derived.brandsMap)) {
            patch.brandsMap = derived.brandsMap;
        }
    }

    if (Array.isArray(data.subcategories)) {
        const normalized = normalizeSubcategories(data.subcategories);
        if (!isEqualJson(data.subcategories, normalized)) {
            patch.subcategories = normalized;
        }
    }

    const geoInput = data?.geo && typeof data.geo === "object"
        ? {
            city: data.geo.city ?? data.city ?? null,
            country: data.geo.country ?? data.country ?? null,
            coords: data.geo.coords ?? data.location ?? null,
            placeId: data.geo.placeId ?? null,
        }
        : (
            data.city && data.country && data.location
                ? {
                    city: data.city,
                    country: data.country,
                    coords: data.location,
                }
                : null
        );

    if (
        geoInput?.city
        && geoInput?.country
        && geoInput?.coords
        && typeof geoInput.coords.lat === "number"
        && typeof geoInput.coords.lng === "number"
    ) {
        const derivedGeo = deriveGeoFields(geoInput);
        if (!isEqualJson(data.geo ?? null, derivedGeo)) {
            patch.geo = derivedGeo;
        }
        if ((data.city ?? null) !== derivedGeo.city) {
            patch.city = derivedGeo.city;
        }
        if (!isEqualJson(data.location ?? null, derivedGeo.coords)) {
            patch.location = derivedGeo.coords;
        }
    }

    for (const field of ["createdAt", "updatedAt", "submittedAt", "reviewedAt", "deletedAt"]) {
        const parsed = parseTimestampString(data?.[field]);
        if (parsed) {
            patch[field] = parsed;
        }
    }

    const migratedHistory = migrateHistory(data?.editHistory);
    if (migratedHistory) {
        patch.editHistory = migratedHistory;
    }

    return Object.keys(patch).length > 0 ? patch : null;
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

    const snapshot = await db.collection("showrooms").get();

    const deleteTargets = [];
    const normalizeTargets = [];
    const reasons = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data() || {};
        const deleteReasons = [];

        if (isSeededShowroom(data)) deleteReasons.push("seed");
        if (looksLikeTestShowroom(data)) deleteReasons.push("pattern");

        if (deleteReasons.length > 0) {
            deleteTargets.push(doc);
            deleteReasons.forEach(reason => {
                reasons[reason] = (reasons[reason] ?? 0) + 1;
            });
            return;
        }

        const patch = buildNormalizationPatch(data);
        if (patch) {
            normalizeTargets.push({ doc, patch });
        }
    });

    const summary = {
        execute,
        scanned: snapshot.size,
        deleteCandidates: deleteTargets.length,
        normalizeCandidates: normalizeTargets.length,
        deleteReasons: reasons,
        sampleDeleteIds: deleteTargets.slice(0, 20).map(doc => ({
            id: doc.id,
            name: doc.data()?.name ?? null,
            ownerUid: doc.data()?.ownerUid ?? null,
            status: doc.data()?.status ?? null,
        })),
        sampleNormalizeIds: normalizeTargets.slice(0, 20).map(item => ({
            id: item.doc.id,
            name: item.doc.data()?.name ?? null,
            fields: Object.keys(item.patch),
        })),
    };

    if (!execute) {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }

    await commitInBatches(db, deleteTargets.map(doc => batch => batch.delete(doc.ref)));
    await commitInBatches(
        db,
        normalizeTargets.map(item => batch => batch.set(item.doc.ref, item.patch, { merge: true }))
    );

    console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
