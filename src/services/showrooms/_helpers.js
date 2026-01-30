export function isSameCountry(left, right) {
    if (!left || !right) return false;
    return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}
