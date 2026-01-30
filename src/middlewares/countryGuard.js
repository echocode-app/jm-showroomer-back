import { isCountryBlocked } from "../constants/countries.js";
import { fail } from "../utils/apiResponse.js";

export function countryGuardFromUser(req, res, next) {
  if (req.user?.country && isCountryBlocked(req.user.country)) {
    return fail(res, "COUNTRY_BLOCKED", "Access restricted by country", 403);
  }
  next();
}
