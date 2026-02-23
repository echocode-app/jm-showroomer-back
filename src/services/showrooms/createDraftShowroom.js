import { getFirestoreInstance } from "../../config/firebase.js";
import { assertUserWritableInTx } from "../users/writeGuardService.js";
import { DEV_STORE, generateId, useDevMock } from "./_store.js";

// createDraftShowroom
export async function createDraftShowroom(ownerUid) {
    if (useDevMock) {
        // DEV mock mode intentionally avoids Firestore-backed user writability reads.
        const existing = DEV_STORE.showrooms.find(
            s => s.ownerUid === ownerUid && s.status === "draft"
        );
        if (existing) return existing;

        const now = new Date().toISOString();
        const draft = {
            id: generateId(),
            ownerUid,
            status: "draft",
            editCount: 0,
            editHistory: [],
            createdAt: now,
            updatedAt: now,
        };
        DEV_STORE.showrooms.push(draft);
        return draft;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms");
    const draftRef = ref.doc();

    return db.runTransaction(async tx => {
        await assertUserWritableInTx(tx, ownerUid);

        const existingSnapshot = await tx.get(
            ref
                .where("ownerUid", "==", ownerUid)
                .where("status", "==", "draft")
                .limit(1)
        );

        if (!existingSnapshot.empty) {
            const doc = existingSnapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }

        const now = new Date().toISOString();
        const draft = {
            ownerUid,
            status: "draft",
            editCount: 0,
            editHistory: [],
            createdAt: now,
            updatedAt: now,
        };

        tx.set(draftRef, draft);
        return { id: draftRef.id, ...draft };
    });
}
