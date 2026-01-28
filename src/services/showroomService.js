import { getFirestoreInstance } from "../config/firebase.js";
import { badRequest, notFound, forbidden } from "../core/error.js";

const BLOCKED_COUNTRIES = ["Russia", "Belarus"];
const EDITABLE_FIELDS = [
    "name",
    "type",
    "availability",
    "category",
    "brands",
    "address",
    "country",
    "city",
    "contacts",
    "location",
];

// CREATE
export async function createShowroom(data, ownerUid) {
    const db = getFirestoreInstance();

    if (!data.name) throw badRequest("SHOWROOM_NAME_REQUIRED");
    if (!data.type) throw badRequest("SHOWROOM_TYPE_REQUIRED");
    if (!data.country) throw badRequest("COUNTRY_REQUIRED");

    if (BLOCKED_COUNTRIES.includes(data.country)) {
        throw badRequest("COUNTRY_BLOCKED");
    }

    const ref = db.collection("showrooms");

    const existing = await ref
        .where("ownerUid", "==", ownerUid)
        .where("name", "==", data.name)
        .where("status", "!=", "deleted")
        .get();

    if (!existing.empty) {
        throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
    }

    const now = new Date().toISOString();

    const showroom = {
        ownerUid,
        name: data.name,
        type: data.type,
        availability: data.availability ?? null,
        category: data.category ?? null,
        brands: data.brands ?? [],

        address: data.address ?? null,
        country: data.country,
        city: data.city ?? null,

        contacts: {
            phone: data.contacts?.phone ?? null,
            instagram: data.contacts?.instagram ?? null,
            website: data.contacts?.website ?? null,
            telegram: data.contacts?.telegram ?? null,
        },

        location: data.location ?? null,

        status: "draft",
        editCount: 0,

        createdAt: now,
        updatedAt: now,
    };

    const doc = await ref.add(showroom);

    return { id: doc.id, ...showroom };
}

// LIST
export async function listShowroomsService(filters = {}, user = null) {
    const db = getFirestoreInstance();
    let query = db.collection("showrooms");

    if (!user) {
        query = query.where("status", "==", "approved");
    } else if (user.role === "owner") {
        query = query.where("ownerUid", "==", user.uid);
        if (filters.status) {
            query = query.where("status", "==", filters.status);
        }
    } else if (user.role === "admin") {
        if (filters.status) {
            query = query.where("status", "==", filters.status);
        }
    }

    if (filters.country) query = query.where("country", "==", filters.country);
    if (filters.city) query = query.where("city", "==", filters.city);
    if (filters.type) query = query.where("type", "==", filters.type);
    if (filters.availability) query = query.where("availability", "==", filters.availability);

    const limit = Number(filters.limit) || 20;
    query = query.limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// GET BY ID
export async function getShowroomByIdService(id, user = null) {
    const db = getFirestoreInstance();
    const doc = await db.collection("showrooms").doc(id).get();

    if (!doc.exists) {
        throw notFound("SHOWROOM_NOT_FOUND");
    }

    const showroom = doc.data();

    if (
        showroom.status !== "approved" &&
        (!user || (user.uid !== showroom.ownerUid && user.role !== "admin"))
    ) {
        throw forbidden("ACCESS_DENIED");
    }

    return { id: doc.id, ...showroom };
}

// UPDATE
export async function updateShowroomService(id, data, user) {
    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    const snap = await ref.get();

    if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = snap.data();

    if (showroom.ownerUid !== user.uid) {
        throw forbidden("ACCESS_DENIED");
    }

    // draft/rejected - owner
    if (showroom.ownerUid === user.uid && !["draft", "rejected"].includes(showroom.status)) {
        throw badRequest("SHOWROOM_NOT_EDITABLE");
    }

    const updates = {};
    const changedFields = {};

    for (const field of EDITABLE_FIELDS) {
        if (data[field] !== undefined && JSON.stringify(data[field]) !== JSON.stringify(showroom[field])) {
            updates[field] = data[field];
            changedFields[field] = { from: showroom[field], to: data[field] };
        }
    }

    if (Object.keys(updates).length === 0) throw badRequest("NO_FIELDS_TO_UPDATE");

    updates.editCount = (showroom.editCount || 0) + 1;
    updates.updatedAt = new Date().toISOString();

    const editEntry = {
        editorUid: user.uid,
        editorRole: user.role,
        timestamp: updates.updatedAt,
        changes: changedFields,
    };

    if (!showroom.editHistory) showroom.editHistory = [];
    updates.editHistory = [...showroom.editHistory, editEntry];

    await ref.update(updates);

    return { id, ...showroom, ...updates };
}

