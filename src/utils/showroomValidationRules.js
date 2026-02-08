import { badRequest } from "../core/error.js";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
    normalizeInstagramUrl,
    normalizePhone,
    normalizeShowroomName,
} from "./showroomNormalization.js";

// Error codes: SHOWROOM_NAME_INVALID, INSTAGRAM_INVALID, PHONE_INVALID, SHOWROOM_INCOMPLETE

// validateShowroomName
export function validateShowroomName(name) {
    const trimmed = String(name ?? "").trim();
    const length = Array.from(trimmed).length;

    if (length < 2 || length > 60) throw badRequest("SHOWROOM_NAME_INVALID");
    if (/^\d+$/u.test(trimmed)) throw badRequest("SHOWROOM_NAME_INVALID");
    if (!/[\p{L}\p{N}]/u.test(trimmed)) {
        throw badRequest("SHOWROOM_NAME_INVALID");
    }
    if (/(.)\1{4,}/u.test(trimmed)) throw badRequest("SHOWROOM_NAME_INVALID");
    if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/u.test(trimmed)) {
        throw badRequest("SHOWROOM_NAME_INVALID");
    }
    if (!/^[\p{L}\p{N}\s\-'&.,()]+$/u.test(trimmed)) {
        throw badRequest("SHOWROOM_NAME_INVALID");
    }
}

// validateInstagramUrl
export function validateInstagramUrl(url) {
    const normalized = normalizeInstagramUrl(url);
    let parsed;

    try {
        parsed = new URL(normalized);
    } catch {
        throw badRequest("INSTAGRAM_INVALID");
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== "instagram.com" && host !== "www.instagram.com") {
        throw badRequest("INSTAGRAM_INVALID");
    }

    if (parsed.search || parsed.hash) throw badRequest("INSTAGRAM_INVALID");

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 1) throw badRequest("INSTAGRAM_INVALID");
}

// validatePhone
export function validatePhone(phone, userCountry = null) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw badRequest("PHONE_INVALID");
    if (!normalized.startsWith("+")) throw badRequest("PHONE_INVALID");

    const parsed = parsePhoneNumberFromString(normalized);
    if (!parsed || !parsed.isValid()) throw badRequest("PHONE_INVALID");

    return {
        e164: parsed.number,
        country: parsed.country ?? undefined,
    };
}

// assertShowroomComplete
export function assertShowroomComplete(showroom) {
    const missing = [];

    if (!showroom?.name) missing.push("name");
    if (!showroom?.type) missing.push("type");
    if (!showroom?.country) missing.push("country");
    if (!showroom?.address) missing.push("address");
    if (!showroom?.city) missing.push("city");
    if (showroom?.availability === undefined || showroom?.availability === null) {
        missing.push("availability");
    }

    if (!showroom?.contacts?.phone) missing.push("contacts.phone");
    if (!showroom?.contacts?.instagram) missing.push("contacts.instagram");

    const lat = showroom?.location?.lat;
    const lng = showroom?.location?.lng;
    if (lat === undefined || lat === null || Number.isNaN(Number(lat))) {
        missing.push("location.lat");
    }
    if (lng === undefined || lng === null || Number.isNaN(Number(lng))) {
        missing.push("location.lng");
    }

    if (missing.length > 0) {
        const err = badRequest("SHOWROOM_INCOMPLETE");
        err.message = `Missing fields: ${missing.join(", ")}`;
        throw err;
    }
}
