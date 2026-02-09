// normalizeShowroomName
export function normalizeShowroomName(name) {
    const normalized = String(name ?? "")
        .trim()
        .replace(/[’‘`]/g, "'")
        .replace(/\s+/g, " ")
        .toLowerCase();

    return normalized.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
}

// normalizeBrand
export function normalizeBrand(brand) {
    const normalized = String(brand ?? "")
        .trim()
        .replace(/[’‘`]/g, "'")
        .replace(/\s+/g, " ")
        .toLowerCase();

    return normalized.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
}

// normalizeKey
export function normalizeKey(value) {
    let normalized = String(value ?? "")
        .trim()
        .replace(/[’‘`]/g, "'")
        .toLowerCase();

    normalized = normalized.replace(/[^\p{L}\p{N}]+/gu, "_");
    normalized = normalized.replace(/^_+|_+$/g, "");
    normalized = normalized.replace(/_+/g, "_");

    return normalized;
}

// normalizeBrands
export function normalizeBrands(brands = []) {
    if (!Array.isArray(brands)) return [];
    const normalized = brands
        .map(brand => normalizeBrand(brand))
        .filter(Boolean);
    return Array.from(new Set(normalized));
}

// normalizeSubcategories
export function normalizeSubcategories(subcategories = []) {
    if (!Array.isArray(subcategories)) return [];
    const normalized = subcategories
        .map(value => normalizeKey(value))
        .filter(Boolean);
    return Array.from(new Set(normalized));
}

// buildBrandsMap
export function buildBrandsMap(brands = []) {
    if (!Array.isArray(brands)) return {};
    const map = {};
    const keys = brands
        .map(value => normalizeKey(value))
        .filter(Boolean);
    keys.forEach(key => {
        map[key] = true;
    });
    return map;
}

// normalizeInstagramUrl
export function normalizeInstagramUrl(url) {
    let normalized = String(url ?? "").trim();

    if (!/^https?:\/\//i.test(normalized)) {
        if (/^(www\.)?instagram\.com\//i.test(normalized)) {
            normalized = `https://${normalized}`;
        }
    }

    return normalized.replace(/\/+$/g, "");
}

// normalizePhone
export function normalizePhone(phone) {
    return String(phone ?? "")
        .trim()
        .replace(/[\s()\-]/g, "");
}

// normalizeAddress
export function normalizeAddress(address) {
    let normalized = String(address ?? "").trim();
    if (!normalized) return "";

    normalized = normalized.replace(/\s+/g, " ");
    normalized = normalized.replace(/,+/g, ",");
    normalized = normalized.replace(/\s*,\s*/g, ", ");
    normalized = normalized.replace(/^,\s*/g, "");
    normalized = normalized.replace(/,\s*$/g, "");

    return normalized;
}

// normalizeAddressForCompare
export function normalizeAddressForCompare(address) {
    return normalizeAddress(address).toLowerCase();
}
