// Access validation for create flow.

import { badRequest, forbidden } from "../../../core/error.js";
import { isCountryBlocked } from "../../../constants/countries.js";
import { isSameCountry } from "../_helpers.js";

export function assertCreatePayload(data) {
    if (!data.name) throw badRequest("SHOWROOM_NAME_REQUIRED");
    if (!data.type) throw badRequest("SHOWROOM_TYPE_REQUIRED");
    if (!data.country) throw badRequest("COUNTRY_REQUIRED");
    if (data.geo && !isSameCountry(data.geo.country, data.country)) {
        throw badRequest("VALIDATION_ERROR");
    }
}

export function assertCreateAccess(data, userCountry) {
    if (isCountryBlocked(data.country)) {
        throw forbidden("COUNTRY_BLOCKED");
    }

    if (userCountry && !isSameCountry(data.country, userCountry)) {
        throw forbidden("ACCESS_DENIED");
    }
}
