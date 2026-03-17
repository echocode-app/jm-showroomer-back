function sanitizeKey(value) {
    if (value === undefined || value === null) return null;

    const normalized = String(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_{2,}/g, "_")
        .slice(0, 60);

    return normalized || null;
}

// Stable client-facing key for localizing lookbook outfit item labels.
export function normalizeLookbookItemNameKey(value) {
    return sanitizeKey(value);
}

// Backward-compatible key inference from legacy plain-text item names.
export function inferLookbookItemNameKey(name) {
    return sanitizeKey(name);
}
