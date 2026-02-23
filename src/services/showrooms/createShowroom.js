import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest } from "../../core/error.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { createDraftShowroom } from "./createDraftShowroom.js";
import { normalizeCreatePayload } from "./create/normalizePayload.js";
import { assertCreateAccess, assertCreatePayload } from "./create/validateAccess.js";
import { DEV_STORE, generateId, useDevMock } from "./_store.js";

// createShowroom
export async function createShowroom(data, ownerUid, options = {}) {
    if (options.draft === true) {
        return createDraftShowroom(ownerUid);
    }

    assertCreatePayload(data);
    assertCreateAccess(data, options.userCountry);

    const normalized = normalizeCreatePayload(data, options);

    if (useDevMock) {
        // DEV mock mode keeps showrooms in memory and may run without Firestore user docs.
        // Writability invariant is enforced in real Firestore-backed flows.
        const id = generateId();
        const now = new Date().toISOString();

        const showroom = {
            id,
            ownerUid,
            status: "draft",
            editCount: 0,
            editHistory: [],
            createdAt: now,
            updatedAt: now,
            ...data,
            ...normalized,
        };

        DEV_STORE.showrooms.push(showroom);
        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms");
    const docRef = ref.doc();

    return db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, ownerUid);

        const existingSnapshot = await tx.get(
            ref
                .where("ownerUid", "==", ownerUid)
                .where("name", "==", data.name)
        );

        // Keep owner-level uniqueness among non-deleted showrooms.
        const existing = existingSnapshot.docs.filter(
            d => d.data().status !== "deleted"
        );

        if (existing.length > 0) {
            throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
        }

        const now = new Date().toISOString();

        const showroom = {
            ownerUid,
            // CANONICAL FIELD
            name: data.name,
            // DERIVED FIELD (persisted for Firestore query/index performance)
            nameNormalized: normalized.nameNormalized,
            type: data.type,
            availability: data.availability ?? null,
            category: data.category ?? null,
            categoryGroup: normalized.categoryGroup,
            subcategories: normalized.subcategories,
            // CANONICAL FIELD
            brands: data.brands ?? [],
            // DERIVED FIELD (persisted for Firestore query/index performance)
            brandsNormalized: normalized.brandsNormalized,
            // DERIVED FIELD (persisted for Firestore query/index performance)
            brandsMap: normalized.brandsMap,
            // CANONICAL FIELD
            address: normalized.address,
            // DERIVED FIELD (duplicate detection only)
            addressNormalized: normalized.addressNormalized,
            country: data.country,
            // COMPATIBILITY FIELD (kept for API stability; canonical source is `geo.city`)
            city: data.city ?? null,
            // CANONICAL FIELD
            geo: normalized.geo,
            contacts: normalized.contacts,
            // COMPATIBILITY FIELD (kept for API stability; canonical source is `geo.coords`)
            location: data.location ?? null,
            status: "draft",
            editCount: 0,
            editHistory: [],
            createdAt: now,
            updatedAt: now,
        };

        tx.set(docRef, showroom);
        return { id: docRef.id, ...showroom };
    });
}
