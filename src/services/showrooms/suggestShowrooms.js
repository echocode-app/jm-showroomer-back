// Service: showroom suggestions entrypoint.

import { getFirestoreInstance } from "../../config/firebase.js";
import { useDevMock } from "./_store.js";
import { buildBaseQuery } from "./list/firestore/baseQuery.js";
import { buildDomainError, isIndexNotReadyError } from "./list/firestore/indexErrors.js";
import { parseSuggestionsFilters } from "./list/parse/suggestions.js";
import { SAMPLE_LIMIT } from "./suggest/constants.js";
import { suggestShowroomsDev } from "./suggest/dev.js";
import { fetchBrandSuggestions, fetchCitySuggestions, fetchShowroomSuggestions } from "./suggest/firestore.js";
import { pushUniqueSuggestion } from "./suggest/builders.js";

/**
 * Builds suggestions using one orchestrated flow for both dev and Firestore modes.
 */
export async function suggestShowroomsService(filters = {}, user = null) {
    const parsed = parseSuggestionsFilters(filters);

    // For very short queries the API intentionally returns no hints.
    if (parsed.qTooShort) {
        return { suggestions: [], meta: { limit: parsed.limit, q: parsed.q } };
    }

    if (useDevMock) {
        return suggestShowroomsDev(parsed, user);
    }

    try {
        const db = getFirestoreInstance();
        const baseQuery = buildBaseQuery(db.collection("showrooms"), parsed, user);

        const suggestions = [];
        const seen = new Set();

        if (parsed.qMode !== "city") {
            const showroomSuggestions = await fetchShowroomSuggestions(baseQuery, parsed, user);
            collectSuggestions(showroomSuggestions, suggestions, seen, parsed.limit);
        }

        if (parsed.qMode === "city" && suggestions.length < parsed.limit) {
            const citySuggestions = await fetchCitySuggestions(
                baseQuery,
                parsed,
                user,
                SAMPLE_LIMIT
            );
            collectSuggestions(citySuggestions, suggestions, seen, parsed.limit);
        }

        if (parsed.qMode !== "city" && suggestions.length < parsed.limit) {
            const brandSuggestions = await fetchBrandSuggestions(
                baseQuery,
                parsed,
                user,
                SAMPLE_LIMIT
            );
            collectSuggestions(brandSuggestions, suggestions, seen, parsed.limit);
        }

        return { suggestions, meta: { limit: parsed.limit, q: parsed.q } };
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            throw buildDomainError("INDEX_NOT_READY", { collection: "showrooms" });
        }
        throw err;
    }
}

/**
 * Appends deduped suggestions until a caller-provided limit is reached.
 */
function collectSuggestions(nextItems, suggestions, seen, limit) {
    for (const item of nextItems) {
        if (suggestions.length >= limit) break;
        pushUniqueSuggestion(item, suggestions, seen);
    }
}
