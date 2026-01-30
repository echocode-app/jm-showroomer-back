import { getFirestoreInstance } from "../../config/firebase.js";
import { DEV_STORE, generateId, useDevMock } from "./_store.js";

export async function createDraftShowroom(ownerUid) {
    if (useDevMock) {
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
    const existingSnapshot = await ref
        .where("ownerUid", "==", ownerUid)
        .where("status", "==", "draft")
        .limit(1)
        .get();

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

    const doc = await ref.add(draft);
    return { id: doc.id, ...draft };
}
