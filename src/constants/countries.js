export const BLOCKED_COUNTRY_CODES = ["ru", "by"];
export const BLOCKED_COUNTRY_NAMES = ["russia", "belarus"];

const COUNTRY_NAME_TO_CODE = new Map();
const COUNTRY_CODE_SET = new Set();

bootstrapCountryIdentityMap();

// normalizeCountry
export function normalizeCountry(value) {
  return String(value).trim().toLowerCase();
}

export function resolveCountryIdentity(country) {
  if (!country) return null;

  const normalized = normalizeCountry(country);
  if (!normalized) return null;

  if (COUNTRY_NAME_TO_CODE.has(normalized)) {
    return COUNTRY_NAME_TO_CODE.get(normalized);
  }

  if (normalized.length === 2 && COUNTRY_CODE_SET.has(normalized)) {
    return normalized;
  }

  return normalized;
}

export function isSameCountryValue(left, right) {
  if (!left || !right) return false;
  return resolveCountryIdentity(left) === resolveCountryIdentity(right);
}

// isCountryBlocked
export function isCountryBlocked(country) {
  if (!country) return false;

  const identity = resolveCountryIdentity(country);
  const normalized = normalizeCountry(country);

  return (
    BLOCKED_COUNTRY_CODES.includes(identity) ||
    BLOCKED_COUNTRY_NAMES.includes(normalized)
  );
}

function bootstrapCountryIdentityMap() {
  registerCountryAlias("ru", "russia");
  registerCountryAlias("by", "belarus");

  if (typeof Intl?.DisplayNames !== "function" || typeof Intl?.supportedValuesOf !== "function") {
    registerFallbackAliases();
    return;
  }

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    for (const code of Intl.supportedValuesOf("region")) {
      if (!/^[A-Z]{2}$/.test(code)) continue;
      registerCountryAlias(code, displayNames.of(code));
    }
  } catch {
    registerFallbackAliases();
  }
}

function registerCountryAlias(code, name) {
  const normalizedCode = normalizeCountry(code);
  if (!normalizedCode) return;

  COUNTRY_CODE_SET.add(normalizedCode);
  COUNTRY_NAME_TO_CODE.set(normalizedCode, normalizedCode);

  const normalizedName = normalizeCountry(name);
  if (normalizedName) {
    COUNTRY_NAME_TO_CODE.set(normalizedName, normalizedCode);
  }
}

function registerFallbackAliases() {
  registerCountryAlias("ua", "ukraine");
  registerCountryAlias("pl", "poland");
  registerCountryAlias("de", "germany");
  registerCountryAlias("fr", "france");
  registerCountryAlias("it", "italy");
  registerCountryAlias("es", "spain");
  registerCountryAlias("gb", "united kingdom");
  registerCountryAlias("uk", "united kingdom");
  registerCountryAlias("us", "united states");
  registerCountryAlias("ca", "canada");
}
