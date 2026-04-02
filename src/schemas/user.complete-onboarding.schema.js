import Joi from "joi";

export const completeOnboardingSchema = Joi.object({
    country: Joi.string().trim().min(2).max(60).required(),
}).unknown(false);
