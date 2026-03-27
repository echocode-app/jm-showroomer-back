// Redistribute duplicate showroom coordinates so identical points do not stack forever on the map.
// Usage:
//   NODE_ENV=dev node scripts/redistribute_duplicate_showroom_coords.js
//   NODE_ENV=dev node scripts/redistribute_duplicate_showroom_coords.js --execute
//   NODE_ENV=prod CONFIRM_SHOWROOM_COORDS_UPDATE=YES node scripts/redistribute_duplicate_showroom_coords.js --execute

import "../src/config/index.js";
import { initFirebase, getFirestoreInstance } from "../src/config/firebase.js";
import { deriveGeoFields } from "../src/services/showrooms/derivedFields.js";

const EXECUTE = process.argv.includes("--execute");
const ENV = process.env.NODE_ENV || "dev";
const PROD_CONFIRM_VAR = "CONFIRM_SHOWROOM_COORDS_UPDATE";
const BATCH_LIMIT = 400;
const BASE_DELTA = 0.00002; // ~2.2m latitude; enough for cluster split without visible city drift.

if (ENV === "prod" && EXECUTE && process.env[PROD_CONFIRM_VAR] !== "YES") {
    console.error(`Refusing to run in prod without ${PROD_CONFIRM_VAR}=YES.`);
    process.exit(1);
}

function buildCoordKey(lat, lng) {
    return `${Number(lat)},${Number(lng)}`;
}

function roundCoord(value) {
    return Number(Number(value).toFixed(7));
}

function buildOffset(index) {
    if (index <= 0) {
        return { latDelta: 0, lngDelta: 0 };
    }

    const ring = Math.ceil(Math.sqrt(index));
    const angle = (index * 137.508) * (Math.PI / 180);
    const distance = BASE_DELTA * ring;

    return {
        latDelta: Math.sin(angle) * distance,
        lngDelta: Math.cos(angle) * distance,
    };
}

function buildUpdatedGeo(data, index) {
    const currentGeo = data?.geo;
    const currentCoords = currentGeo?.coords;
    const currentLat = Number(currentCoords?.lat);
    const currentLng = Number(currentCoords?.lng);

    if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
        return null;
    }

    const { latDelta, lngDelta } = buildOffset(index);
    const nextLat = roundCoord(currentLat + latDelta);
    const nextLng = roundCoord(currentLng + lngDelta);

    const geo = deriveGeoFields({
        city: currentGeo?.city ?? data?.city ?? "",
        country: currentGeo?.country ?? data?.country ?? null,
        placeId: currentGeo?.placeId ?? null,
        coords: {
            lat: nextLat,
            lng: nextLng,
        },
    });

    return {
        previous: { lat: currentLat, lng: currentLng },
        next: { lat: nextLat, lng: nextLng },
        geo,
    };
}

function groupDuplicateDocs(docs) {
    const groups = new Map();

    for (const doc of docs) {
        const data = doc.data() || {};
        const lat = Number(data?.geo?.coords?.lat);
        const lng = Number(data?.geo?.coords?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue;
        }

        const key = buildCoordKey(lat, lng);
        const entry = groups.get(key) || [];
        entry.push({
            id: doc.id,
            ref: doc.ref,
            data,
            createdAt: String(data?.createdAt ?? ""),
            updatedAt: String(data?.updatedAt ?? ""),
            name: data?.name ?? null,
            status: data?.status ?? null,
        });
        groups.set(key, entry);
    }

    return Array.from(groups.entries())
        .map(([key, items]) => ({
            key,
            items: items.sort((a, b) => {
                const createdCmp = a.createdAt.localeCompare(b.createdAt);
                if (createdCmp !== 0) return createdCmp;
                const updatedCmp = a.updatedAt.localeCompare(b.updatedAt);
                if (updatedCmp !== 0) return updatedCmp;
                return a.id.localeCompare(b.id);
            }),
        }))
        .filter(group => group.items.length > 1);
}

async function commitUpdates(updates) {
    if (updates.length === 0) return;

    const db = getFirestoreInstance();
    let batch = db.batch();
    let ops = 0;

    for (const item of updates) {
        batch.update(item.ref, item.payload);
        ops += 1;

        if (ops >= BATCH_LIMIT) {
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
    const duplicateGroups = groupDuplicateDocs(snapshot.docs);
    const updates = [];
    const preview = [];

    for (const group of duplicateGroups) {
        for (let i = 1; i < group.items.length; i += 1) {
            const item = group.items[i];
            const updatedGeo = buildUpdatedGeo(item.data, i);
            if (!updatedGeo) continue;

            updates.push({
                id: item.id,
                ref: item.ref,
                payload: {
                    geo: updatedGeo.geo,
                    location: updatedGeo.geo.coords,
                    city: updatedGeo.geo.city ?? item.data?.city ?? null,
                    country: updatedGeo.geo.country ?? item.data?.country ?? null,
                    updatedAt: new Date().toISOString(),
                },
            });

            if (preview.length < 50) {
                preview.push({
                    id: item.id,
                    name: item.name,
                    status: item.status,
                    from: updatedGeo.previous,
                    to: updatedGeo.next,
                    duplicateGroup: group.key,
                    sequence: i + 1,
                });
            }
        }
    }

    const summary = {
        env: ENV,
        execute: EXECUTE,
        scanned: snapshot.size,
        duplicateGroups: duplicateGroups.length,
        affectedShowrooms: updates.length,
        preview,
    };

    if (!EXECUTE) {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }

    await commitUpdates(updates);
    console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
