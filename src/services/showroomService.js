// src/services/showroomService.js
import { getFirestoreInstance } from "../config/firebase.js";
import { badRequest, notFound, forbidden } from "../core/error.js";
import isEqual from "lodash.isequal";

/**
 * Countries where showroom creation is blocked
 */
const BLOCKED_COUNTRIES = ["Russia", "Belarus"];

/**
 * Fields allowed to be updated by the owner
 */
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

/**
 * DEV Mock Store for testing without Firestore
 */
const useDevMock = process.env.NODE_ENV === "dev";
const DEV_STORE = { showrooms: [] };

/**
 * Simple ID generator for DEV mock
 */
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * CREATE Showroom
 * - Validates input
 * - Prevents duplicates and blocked countries
 * - Initializes edit history and timestamps
 */
export async function createShowroom(data, ownerUid) {
    if (!data.name) throw badRequest("SHOWROOM_NAME_REQUIRED");
    if (!data.type) throw badRequest("SHOWROOM_TYPE_REQUIRED");
    if (!data.country) throw badRequest("COUNTRY_REQUIRED");

    if (BLOCKED_COUNTRIES.includes(data.country)) {
        throw badRequest("COUNTRY_BLOCKED");
    }

    if (useDevMock) {
        // DEV: add showroom to in-memory store
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
        };
        DEV_STORE.showrooms.push(showroom);
        return showroom;
    }

    // PROD: Firestore
    const db = getFirestoreInstance();
    const ref = db.collection("showrooms");

    // Firestore cannot filter != in multi-where, filter manually
    const existingSnapshot = await ref
        .where("ownerUid", "==", ownerUid)
        .where("name", "==", data.name)
        .get();

    const existing = existingSnapshot.docs.filter(d => d.data().status !== "deleted");
    if (existing.length > 0) throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");

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
        editHistory: [],
    };

    const doc = await ref.add(showroom);
    return { id: doc.id, ...showroom };
}

/**
 * LIST Showrooms
 * - Applies filters
 * - Enforces role-based access
 */
export async function listShowroomsService(filters = {}, user = null) {
    if (useDevMock) {
        // DEV: filter in-memory store
        let result = DEV_STORE.showrooms;
        if (!user) {
            result = result.filter(s => s.status === "approved");
        } else if (user.role === "owner") {
            result = result.filter(s => s.ownerUid === user.uid);
            if (filters.status) result = result.filter(s => s.status === filters.status);
        } else if (user.role === "admin" && filters.status) {
            result = result.filter(s => s.status === filters.status);
        }

        // Apply additional filters
        if (filters.country) result = result.filter(s => s.country === filters.country);
        if (filters.city) result = result.filter(s => s.city === filters.city);
        if (filters.type) result = result.filter(s => s.type === filters.type);
        if (filters.availability) result = result.filter(s => s.availability === filters.availability);

        const limit = Number(filters.limit) || 20;
        return result.slice(0, limit);
    }

    // PROD: Firestore
    const db = getFirestoreInstance();
    let query = db.collection("showrooms");

    if (!user) {
        query = query.where("status", "==", "approved");
    } else if (user.role === "owner") {
        query = query.where("ownerUid", "==", user.uid);
        if (filters.status) query = query.where("status", "==", filters.status);
    } else if (user.role === "admin" && filters.status) {
        query = query.where("status", "==", filters.status);
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

/**
 * GET Showroom by ID
 * - Returns showroom if user has access
 * - Only approved or owner/admin can see draft/rejected
 */
export async function getShowroomByIdService(id, user = null) {
    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");

        if (showroom.status !== "approved" && (!user || (user.uid !== showroom.ownerUid && user.role !== "admin"))) {
            throw forbidden("ACCESS_DENIED");
        }
        return showroom;
    }

    const db = getFirestoreInstance();
    const doc = await db.collection("showrooms").doc(id).get();
    if (!doc.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = doc.data();
    if (showroom.status !== "approved" && (!user || (user.uid !== showroom.ownerUid && user.role !== "admin"))) {
        throw forbidden("ACCESS_DENIED");
    }

    return { id: doc.id, ...showroom };
}

/**
 * UPDATE Showroom
 * - Only owner can edit draft/rejected
 * - Tracks edit history
 */
export async function updateShowroomService(id, data, user) {
    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");
        if (showroom.ownerUid !== user.uid) throw forbidden("ACCESS_DENIED");
        if (!["draft", "rejected"].includes(showroom.status)) throw badRequest("SHOWROOM_NOT_EDITABLE");

        const changedFields = {};
        EDITABLE_FIELDS.forEach(f => {
            if (data[f] !== undefined && !isEqual(data[f], showroom[f])) {
                changedFields[f] = { from: showroom[f], to: data[f] };
                showroom[f] = data[f];
            }
        });

        if (Object.keys(changedFields).length === 0) throw badRequest("NO_FIELDS_TO_UPDATE");

        showroom.editCount = (showroom.editCount || 0) + 1;
        showroom.updatedAt = new Date().toISOString();
        showroom.editHistory.push({
            editorUid: user.uid,
            editorRole: user.role,
            timestamp: showroom.updatedAt,
            changes: changedFields,
        });

        return showroom;
    }

    // PROD: Firestore
    const db = getFirestoreInstance();
    const ref = db.collection("showrooms").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = snap.data();
    if (showroom.ownerUid !== user.uid) throw forbidden("ACCESS_DENIED");
    if (!["draft", "rejected"].includes(showroom.status)) throw badRequest("SHOWROOM_NOT_EDITABLE");

    const updates = {};
    const changedFields = {};
    for (const field of EDITABLE_FIELDS) {
        if (data[field] !== undefined && !isEqual(data[field], showroom[field])) {
            updates[field] = data[field];
            changedFields[field] = { from: showroom[field], to: data[field] };
        }
    }

    if (Object.keys(updates).length === 0) throw badRequest("NO_FIELDS_TO_UPDATE");

    updates.editCount = (showroom.editCount || 0) + 1;
    updates.updatedAt = new Date().toISOString();
    updates.editHistory = [...(showroom.editHistory || []), {
        editorUid: user.uid,
        editorRole: user.role,
        timestamp: updates.updatedAt,
        changes: changedFields,
    }];

    await ref.update(updates);
    return { id, ...showroom, ...updates };
}
