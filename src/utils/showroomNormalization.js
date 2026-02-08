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

// normalizeBrands
export function normalizeBrands(brands = []) {
    if (!Array.isArray(brands)) return [];
    const normalized = brands
        .map(brand => normalizeBrand(brand))
        .filter(Boolean);
    return Array.from(new Set(normalized));
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
