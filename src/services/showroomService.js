import { getFirestoreInstance } from "../config/firebase.js";

const BLOCKED_COUNTRIES = ["Russia", "Belarus"];

export async function createShowroom(data, ownerUid) {
    const db = getFirestoreInstance();

    // Validate required fields
    if (!ownerUid) throw new Error("Missing owner UID");
    if (!data.name) throw new Error("Showroom name is required");
    if (!data.type) throw new Error("Showroom type is required");

    if (BLOCKED_COUNTRIES.includes(data.country)) {
        const err = new Error("Cannot create showroom in blocked country");
        err.status = 400;
        throw err;
    }

    const showroomRef = db.collection("showrooms");

    // Check if showroom with same name already exists for this owner
    const snapshot = await showroomRef
        .where("ownerUid", "==", ownerUid)
        .where("name", "==", data.name)
        .get();

    if (!snapshot.empty) {
        const err = new Error("Showroom with this name already exists");
        err.status = 400;
        throw err;
    }

    // Prepare Firestore-safe data
    const showroomData = {
        ownerUid,
        name: data.name,
        type: data.type,
        availability: data.availability ?? null,
        address: data.address ?? null,
        country: data.country ?? null,
        contacts: {
            phone: data.contacts?.phone ?? null,
            instagram: data.contacts?.instagram ?? null,
        },
        location: {
            lat: data.location?.lat ?? null,
            lng: data.location?.lng ?? null,
        },
        status: "draft", // draft / pending / approved / rejected
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const docRef = await showroomRef.add(showroomData);

    return { id: docRef.id, ...showroomData };
}
