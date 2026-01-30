import { forbidden } from "../core/error.js";
import { isCountryBlocked } from "../constants/countries.js";

export function blockRestrictedCountries(req, res, next) {
  const candidates = [
    // explicit override (tests, future geo)
    req.headers["x-country-code"],

    // request payload
    req.body?.country,
    req.query?.country,
    req.body?.address?.country,

    // user profile (on update actions)
    req.user?.country,
  ];

  const country = candidates.find(Boolean);

  if (country && isCountryBlocked(country)) {
    throw forbidden("COUNTRY_BLOCKED");
  }

  next();
}
