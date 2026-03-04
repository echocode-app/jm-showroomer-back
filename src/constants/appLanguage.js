export const APP_LANGUAGES = Object.freeze({
    UK: "uk",
    EN: "en",
});

const ALIAS_TO_CANONICAL = Object.freeze({
    uk: APP_LANGUAGES.UK,
    ua: APP_LANGUAGES.UK,
    "uk-ua": APP_LANGUAGES.UK,
    "uk_ua": APP_LANGUAGES.UK,
    en: APP_LANGUAGES.EN,
    "en-us": APP_LANGUAGES.EN,
    "en-gb": APP_LANGUAGES.EN,
    "en_us": APP_LANGUAGES.EN,
    "en_gb": APP_LANGUAGES.EN,
});

export function normalizeAppLanguage(input, fallback = APP_LANGUAGES.EN) {
    const raw = String(input || "").trim().toLowerCase();
    if (!raw) return fallback;
    return ALIAS_TO_CANONICAL[raw] || fallback;
}

export function isSupportedAppLanguage(input) {
    const normalized = normalizeAppLanguage(input, "__unsupported__");
    return normalized === APP_LANGUAGES.UK || normalized === APP_LANGUAGES.EN;
}
