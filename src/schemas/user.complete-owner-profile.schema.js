import Joi from "joi";

export const completeOwnerProfileSchema = Joi.object({
    name: Joi.string().min(2).max(60).required(),
    position: Joi.string().allow("", null),
    country: Joi.string().required(),
    instagram: Joi.string().required(),
}).unknown(false);
