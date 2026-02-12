// Dev-mode suggestion flow.

import { filterDevShowroomsBase } from "../list/devFilters.js";
import { SHOWROOM_SUGGEST_LIMIT } from "./constants.js";
import {
    buildBrandSuggestions,
    buildCitySuggestions,
    pushUniqueSuggestion,
    toShowroomSuggestion,
} from "./builders.js";

/**
 * Runs suggestion logic against the in-memory DEV store.
 */
export function suggestShowroomsDev(parsed, user) {
    const base = filterDevShowroomsBase(parsed, user);
    const suggestions = [];
    const seen = new Set();

    if (parsed.qMode !== "city") {
        const showroomItems = base
            .filter(s => String(s.nameNormalized ?? "").startsWith(parsed.qName))
            .slice(0, Math.min(parsed.limit, SHOWROOM_SUGGEST_LIMIT))
            .map(toShowroomSuggestion);

        for (const item of showroomItems) {
            if (suggestions.length >= parsed.limit) break;
            pushUniqueSuggestion(item, suggestions, seen);
        }
    }

    if (parsed.qMode === "city" && suggestions.length < parsed.limit) {
        const cityItems = buildCitySuggestions(base, parsed);
        for (const item of cityItems) {
            if (suggestions.length >= parsed.limit) break;
            pushUniqueSuggestion(item, suggestions, seen);
        }
    }

    if (parsed.qMode !== "city" && suggestions.length < parsed.limit) {
        const brandItems = buildBrandSuggestions(base, parsed);
        for (const item of brandItems) {
            if (suggestions.length >= parsed.limit) break;
            pushUniqueSuggestion(item, suggestions, seen);
        }
    }

    return { suggestions, meta: { limit: parsed.limit, q: parsed.q } };
}
