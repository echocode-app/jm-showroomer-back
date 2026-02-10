// Service: showroom counters.

import { getFirestoreInstance } from "../../config/firebase.js";
import {
    BLOCKED_COUNTRY_CODES,
    BLOCKED_COUNTRY_NAMES,
    isCountryBlocked,
} from "../../constants/countries.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { buildBaseQuery } from "./list/firestore/baseQuery.js";
import { buildDomainError, isIndexNotReadyError } from "./list/firestore/indexErrors.js";
import { parseCountersFilters } from "./list/parse/counters.js";
import { getVisibilityFilter } from "./list/utils/visibility.js";

export async function countShowroomsService(filters = {}, user = null) {
    const parsed = parseCountersFilters(filters);
    if (parsed.raw?.country && isCountryBlocked(parsed.raw.country)) {
        const mode =
            parsed.geohashPrefixes.length > 1
                ? "multi_prefix"
                : parsed.geohashPrefixes.length === 1
                  ? "single_prefix"
                  : "no_geo";
        return {
            total: 0,
            meta: {
                mode,
                prefixesCount: parsed.geohashPrefixes.length,
            },
        };
    }
    if (useDevMock) {
        return countShowroomsDev(parsed, user);
    }

    const db = getFirestoreInstance();

    if (parsed.geohashPrefixes.length > 1) {
        const totals = await Promise.all(
            parsed.geohashPrefixes.map(prefix =>
                countForPrefix(db, parsed, user, prefix)
            )
        );
        const total = totals.reduce((sum, v) => sum + v, 0);
        return {
            total,
            meta: { mode: "multi_prefix", prefixesCount: parsed.geohashPrefixes.length },
        };
    }

    const total = await countForPrefix(
        db,
        parsed,
        user,
        parsed.geohashPrefixes[0] ?? null
    );

    return {
        total,
        meta: {
            mode: parsed.geohashPrefixes.length === 1 ? "single_prefix" : "no_geo",
            prefixesCount: parsed.geohashPrefixes.length,
        },
    };
}

function countShowroomsDev(parsed, user) {
    const items = filterDevShowrooms(parsed, user);

    if (parsed.geohashPrefixes.length > 1) {
        const total = parsed.geohashPrefixes.reduce((sum, prefix) => {
            return sum + countItems(items, parsed, prefix);
        }, 0);
        return {
            total,
            meta: { mode: "multi_prefix", prefixesCount: parsed.geohashPrefixes.length },
        };
    }

    const total = countItems(items, parsed, parsed.geohashPrefixes[0] ?? null);
    return {
        total,
        meta: {
            mode: parsed.geohashPrefixes.length === 1 ? "single_prefix" : "no_geo",
            prefixesCount: parsed.geohashPrefixes.length,
        },
    };
}

function filterDevShowrooms(parsed, user) {
    const filters = parsed.raw;
    let result = DEV_STORE.showrooms;
    const visibility = getVisibilityFilter(user, filters.status);

    if (visibility.type === "guest") {
        result = result.filter(s => s.status === "approved");
    } else if (visibility.type === "owner") {
        result = result.filter(s => s.ownerUid === user.uid);
        if (visibility.status) {
            if (visibility.status === "deleted") return [];
            result = result.filter(s => s.status === visibility.status);
        }
    } else if (visibility.type === "admin" && visibility.status) {
        result = result.filter(s => s.status === visibility.status);
    }

    if (filters.country) result = result.filter(s => s.country === filters.country);
    if (parsed.cityNormalized) {
        result = result.filter(s => s.geo?.cityNormalized === parsed.cityNormalized);
    }
    if (parsed.type) result = result.filter(s => s.type === parsed.type);
    if (filters.availability) {
        result = result.filter(s => s.availability === filters.availability);
    }
    if (filters.category) {
        result = result.filter(s => s.category === filters.category);
    }
    if (parsed.categories.length > 0) {
        result = result.filter(s => parsed.categories.includes(s.category));
    }
    if (parsed.categoryGroups.length > 0) {
        result = result.filter(s =>
            parsed.categoryGroups.includes(s.categoryGroup)
        );
    }
    if (parsed.subcategories.length > 0) {
        result = result.filter(s =>
            (s.subcategories ?? []).some(sub =>
                parsed.subcategories.includes(sub)
            )
        );
    }
    if (parsed.brandKey) {
        result = result.filter(s =>
            s.brandsMap?.[parsed.brandKey] === true ||
            (s.brandsNormalized ?? []).includes(parsed.brandNormalized)
        );
    }

    if (!user || user.role === "owner") {
        result = result.filter(s => s.status !== "deleted");
    }

    result = result.filter(s => !isCountryBlocked(s.country));
    return result;
}

function countItems(items, parsed, prefix) {
    let result = items;
    if (prefix) {
        result = result.filter(s =>
            String(s.geo?.geohash ?? "").startsWith(prefix)
        );
    }
    if (parsed.qName) {
        result = result.filter(s =>
            String(s.nameNormalized ?? "").startsWith(parsed.qName)
        );
    }
    return result.length;
}

async function countForPrefix(db, parsed, user, prefix) {
    let query = buildBaseQuery(db.collection("showrooms"), parsed, user);

    if (prefix) {
        query = query
            .where("geo.geohash", ">=", prefix)
            .where("geo.geohash", "<=", `${prefix}\uf8ff`)
            .orderBy("geo.geohash", "asc");
    }

    if (parsed.qName) {
        query = query
            .where("nameNormalized", ">=", parsed.qName)
            .where("nameNormalized", "<=", `${parsed.qName}\uf8ff`)
            .orderBy("nameNormalized", "asc");
    }

    return await countWithBlockedFilter(query, parsed);
}

function getBlockedCountryVariants() {
    const variants = new Set();
    const addVariants = value => {
        if (!value) return;
        const raw = String(value);
        variants.add(raw);
        variants.add(raw.toLowerCase());
        variants.add(raw.toUpperCase());
        variants.add(raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
    };
    BLOCKED_COUNTRY_CODES.forEach(addVariants);
    BLOCKED_COUNTRY_NAMES.forEach(addVariants);
    return Array.from(variants);
}

async function countWithBlockedFilter(query, parsed) {
    const total = await countQuery(query);
    if (parsed.raw?.country) return total;

    const blocked = getBlockedCountryVariants();
    if (blocked.length === 0) return total;

    const blockedTotals = await Promise.all(
        blocked.map(value => countQuery(query.where("country", "==", value)))
    );
    const blockedSum = blockedTotals.reduce((sum, v) => sum + v, 0);
    return Math.max(0, total - blockedSum);
}

async function countQuery(query) {
    try {
        const snapshot = await query.count().get();
        return snapshot.data().count ?? 0;
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY");
        }
        throw err;
    }
}
