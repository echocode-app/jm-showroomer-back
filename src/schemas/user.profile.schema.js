import Joi from "joi";

export const userProfileUpdateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(60),
    country: Joi.string().trim().min(2).max(60),
    instagram: Joi.string().trim().min(2).max(200),
    position: Joi.string().trim().allow("", null).max(100),
    appLanguage: Joi.string().trim().min(2).max(10),
    notificationsEnabled: Joi.boolean().strict(),
}).min(1).unknown(false);
