// Shared helpers for showroom counter service.

import { BLOCKED_COUNTRY_CODES, BLOCKED_COUNTRY_NAMES } from "../../../constants/countries.js";
import { buildDomainError, isIndexNotReadyError } from "../list/firestore/indexErrors.js";

/**
 * Applies q/prefix-specific counting over a pre-filtered item set.
 */
export function countItems(items, parsed, prefix) {
    let result = items;
    if (prefix) {
        result = result.filter(s => String(s.geo?.geohash ?? "").startsWith(prefix));
    }
    if (parsed.qName) {
        result = result.filter(s => String(s.nameNormalized ?? "").startsWith(parsed.qName));
    }
    return result.length;
}

/**
 * Produces all known blocked-country text variants used in legacy data.
 */
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

/**
 * Removes blocked-country documents from aggregate count when country is not fixed.
 */
export async function countWithBlockedFilter(query, parsed) {
    const total = await countQuery(query);
    if (parsed.raw?.country) return total;

    const blocked = getBlockedCountryVariants();
    if (blocked.length === 0) return total;

    const blockedTotals = await Promise.all(
        blocked.map(value => countQuery(query.where("country", "==", value)))
    );
    const blockedSum = blockedTotals.reduce((sum, value) => sum + value, 0);
    return Math.max(0, total - blockedSum);
}

/**
 * Wraps Firestore count API and maps index-missing errors to domain code.
 */
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
