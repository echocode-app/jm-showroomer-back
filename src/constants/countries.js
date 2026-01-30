export const BLOCKED_COUNTRY_CODES = ["ru", "by"];
export const BLOCKED_COUNTRY_NAMES = ["russia", "belarus"];

export function normalizeCountry(value) {
  return String(value).trim().toLowerCase();
}

export function isCountryBlocked(country) {
  if (!country) return false;

  const normalized = normalizeCountry(country);

  return (
    BLOCKED_COUNTRY_CODES.includes(normalized) ||
    BLOCKED_COUNTRY_NAMES.includes(normalized)
  );
}
