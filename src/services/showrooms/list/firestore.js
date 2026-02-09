// Showroom list firestore helpers.

// Showroom list (Firestore) implementation.
import { getFirestoreInstance } from "../../../config/firebase.js";
import { isCountryBlocked } from "../../../constants/countries.js";
import { getMessageForCode, getStatusForCode } from "../../../core/errorCodes.js";
import { FieldPath } from "firebase-admin/firestore";
import { getOrdering } from "./ordering.js";
import {
    applyCursorFilter,
    applyFieldMode,
    applyVisibilityPostFilter,
    buildMeta,
    compareValues,
    getValueByPath,
    getVisibilityFilter,
    mergeSnapshots,
} from "./utils.js";

export async function listShowroomsFirestore(parsed, user) {
    const filters = parsed.raw;
    const db = getFirestoreInstance();
    const baseQuery = buildBaseQuery(db.collection("showrooms"), parsed, user);
    const { orderField, direction } = getOrdering(parsed);

    try {
        if (parsed.geohashPrefixes.length > 0) {
            const snapshots = await Promise.all(
                parsed.geohashPrefixes.map(prefix =>
                    buildGeohashQuery(baseQuery, prefix, parsed, orderField, direction).get()
                )
            );

            let items = mergeSnapshots(snapshots);
            items = applyVisibilityPostFilter(items, user);
            items = items.filter(s => !isCountryBlocked(s.country));

            if (parsed.qName) {
                items = items.filter(s => {
                    const nameOk = parsed.qName
                        ? String(s.nameNormalized ?? "").startsWith(parsed.qName)
                        : false;
                    return nameOk;
                });
            }

            items.sort((a, b) => {
                const cmp = compareValues(
                    getValueByPath(a, orderField),
                    getValueByPath(b, orderField),
                    direction
                );
                if (cmp !== 0) return cmp;
                return a.id.localeCompare(b.id);
            });

            if (parsed.cursorDisabled) {
                const pageItems = items.slice(0, parsed.limit);
                const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
                return { showrooms, meta: { nextCursor: null, hasMore: false } };
            }

            const cursorFiltered = applyCursorFilter(items, parsed.cursor, orderField, direction);
            const { pageItems, meta } = buildMeta(
                cursorFiltered,
                parsed.limit,
                orderField,
                direction
            );
            const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
            return { showrooms, meta };
        }

        if (parsed.qName) {
            let query = buildPrefixQuery(baseQuery, "nameNormalized", parsed.qName);
            if (parsed.cursor) {
                query = query.startAfter(parsed.cursor.value, parsed.cursor.id);
            }
            query = query.limit(parsed.limit + 1);

            const snapshot = await query.get();
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            items = applyVisibilityPostFilter(items, user);
            items = items.filter(s => !isCountryBlocked(s.country));
            const { pageItems, meta } = buildMeta(items, parsed.limit, "nameNormalized", "asc");
            const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
            return { showrooms, meta };
        }

        let query = baseQuery;
        query = applyOrdering(query, orderField, direction);
        if (parsed.cursor) {
            query = query.startAfter(parsed.cursor.value, parsed.cursor.id);
        }
        query = query.limit(parsed.limit + 1);

        const snapshot = await query.get();
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        items = applyVisibilityPostFilter(items, user);
        items = items.filter(s => !isCountryBlocked(s.country));
        const { pageItems, meta } = buildMeta(items, parsed.limit, orderField, direction);
        const showrooms = pageItems.map(s => applyFieldMode(s, parsed.fields));
        return { showrooms, meta };
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY");
        }
        throw err;
    }
}

function isIndexNotReadyError(err) {
    if (!err) return false;
    const code = err.code;
    const message = String(err.message ?? "").toLowerCase();
    return (
        code === 9 ||
        code === "FAILED_PRECONDITION" ||
        message.includes("failed_precondition")
    ) && message.includes("requires an index");
}

function buildDomainError(code) {
    const err = new Error(getMessageForCode(code, code));
    err.code = code;
    err.status = getStatusForCode(code) ?? 500;
    return err;
}

function buildBaseQuery(query, parsed, user) {
    const filters = parsed.raw;
    const visibility = getVisibilityFilter(user, filters.status);

    if (visibility.type === "guest") {
        query = query.where("status", "==", "approved");
    } else if (visibility.type === "owner") {
        if (visibility.status === "deleted") {
            return query.where("status", "==", "__none__");
        }
        query = query.where("ownerUid", "==", user.uid);
        if (visibility.status) {
            query = query.where("status", "==", visibility.status);
        }
    } else if (visibility.type === "admin" && visibility.status) {
        query = query.where("status", "==", visibility.status);
    }

    if (filters.country) query = query.where("country", "==", filters.country);
    if (parsed.cityNormalized) {
        query = query.where("geo.cityNormalized", "==", parsed.cityNormalized);
    }
    if (filters.type) query = query.where("type", "==", filters.type);
    if (filters.availability) {
        query = query.where("availability", "==", filters.availability);
    }
    if (filters.category) query = query.where("category", "==", filters.category);
    if (parsed.categories.length > 0) {
        const slice = parsed.categories.slice(0, 10);
        query = query.where("category", "in", slice);
    }
    if (parsed.brandNormalized) {
        query = query.where("brandsNormalized", "array-contains", parsed.brandNormalized);
    }

    return query;
}

function buildGeohashQuery(baseQuery, prefix, parsed, orderField, direction) {
    let query = baseQuery
        .where("geo.geohash", ">=", prefix)
        .where("geo.geohash", "<=", `${prefix}\uf8ff`);
    query = applyOrdering(query, orderField, direction);
    if (parsed.cursor && !parsed.cursorDisabled) {
        query = query.startAfter(parsed.cursor.value, parsed.cursor.id);
    }
    query = query.limit(parsed.limit + 1);
    return query;
}

function buildPrefixQuery(baseQuery, field, prefix) {
    return baseQuery
        .where(field, ">=", prefix)
        .where(field, "<=", `${prefix}\uf8ff`)
        .orderBy(field, "asc")
        .orderBy(FieldPath.documentId(), "asc");
}

function applyOrdering(query, orderField, direction) {
    query = query.orderBy(orderField, direction);
    query = query.orderBy(FieldPath.documentId(), "asc");
    return query;
}
