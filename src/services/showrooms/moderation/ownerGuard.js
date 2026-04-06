import { badRequest } from "../../../core/error.js";
import { getFirestoreInstance } from "../../../config/firebase.js";

function isDeletedOwnerData(userDoc) {
    return !userDoc || userDoc.isDeleted === true;
}

export async function isShowroomOwnerDeleted(ownerUid) {
    if (!ownerUid) return true;
    const snap = await getFirestoreInstance().collection("users").doc(ownerUid).get();
    return !snap.exists || isDeletedOwnerData(snap.data() || null);
}

export async function filterOutShowroomsWithDeletedOwners(showrooms = []) {
    const ownerUids = [...new Set(showrooms.map(showroom => showroom?.ownerUid).filter(Boolean))];
    const ownerStates = new Map();

    await Promise.all(ownerUids.map(async ownerUid => {
        ownerStates.set(ownerUid, await isShowroomOwnerDeleted(ownerUid));
    }));

    return showrooms.filter(showroom => !ownerStates.get(showroom?.ownerUid));
}

export async function assertShowroomOwnerActiveInTx(tx, ownerUid) {
    if (!ownerUid) {
        throw badRequest("SHOWROOM_OWNER_DELETED");
    }

    const ref = getFirestoreInstance().collection("users").doc(ownerUid);
    const snap = await tx.get(ref);
    if (!snap.exists || isDeletedOwnerData(snap.data() || null)) {
        throw badRequest("SHOWROOM_OWNER_DELETED");
    }
}
