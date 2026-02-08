// Joi schema: complete owner profile validation rules.

import Joi from "joi";

// Owner profile requires name/country/instagram; position is optional.
export const completeOwnerProfileSchema = Joi.object({
    name: Joi.string().min(2).max(60).required(),
    position: Joi.string().allow("", null),
    country: Joi.string().required(),
    instagram: Joi.string().required(),
}).unknown(false);
