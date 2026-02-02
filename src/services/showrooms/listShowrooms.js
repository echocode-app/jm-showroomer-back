import { getFirestoreInstance } from "../../config/firebase.js";
import { isCountryBlocked } from "../../constants/countries.js";
import { DEV_STORE, useDevMock } from "./_store.js";

export async function listShowroomsService(filters = {}, user = null) {
    if (useDevMock) {
        let result = DEV_STORE.showrooms;

        if (!user) {
            result = result.filter(s => s.status === "approved");
        } else if (user.role === "owner") {
            result = result.filter(s => s.ownerUid === user.uid);
            if (filters.status) {
                if (filters.status === "deleted") return [];
                result = result.filter(s => s.status === filters.status);
            }
        } else if (user.role === "admin" && filters.status) {
            result = result.filter(s => s.status === filters.status);
        }

        if (filters.country) result = result.filter(s => s.country === filters.country);
        if (filters.city) result = result.filter(s => s.city === filters.city);
        if (filters.type) result = result.filter(s => s.type === filters.type);
        if (filters.availability) {
            result = result.filter(s => s.availability === filters.availability);
        }

        const limit = Number(filters.limit) || 20;
        if (!user || user.role === "owner") {
            result = result.filter(s => s.status !== "deleted");
        }
        return result
            .filter(s => !isCountryBlocked(s.country))
            .slice(0, limit);
    }

    const db = getFirestoreInstance();
    let query = db.collection("showrooms");

    if (!user) {
        query = query.where("status", "==", "approved");
    } else if (user.role === "owner") {
        if (filters.status === "deleted") return [];
        query = query.where("ownerUid", "==", user.uid);
        if (filters.status) {
            query = query.where("status", "==", filters.status);
        }
    } else if (user.role === "admin" && filters.status) {
        query = query.where("status", "==", filters.status);
    }

    if (filters.country) query = query.where("country", "==", filters.country);
    if (filters.city) query = query.where("city", "==", filters.city);
    if (filters.type) query = query.where("type", "==", filters.type);
    if (filters.availability) {
        query = query.where("availability", "==", filters.availability);
    }

    const limit = Number(filters.limit) || 20;
    query = query.limit(limit);

    const snapshot = await query.get();
    let result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (!user || user.role === "owner") {
        result = result.filter(s => s.status !== "deleted");
    }
    return result.filter(s => !isCountryBlocked(s.country));
}
