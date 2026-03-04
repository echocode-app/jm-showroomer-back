// Joi schema: user profile update validation rules.

import Joi from "joi";
import { APP_LANGUAGES } from "../constants/appLanguage.js";

// Profile update allows partial fields; at least one field is required.
export const userProfileUpdateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(60),
    country: Joi.string().trim().min(2).max(60),
    instagram: Joi.string().trim().min(2).max(200),
    position: Joi.string().trim().allow("", null).max(100),
    appLanguage: Joi.string().trim().lowercase().valid(
        APP_LANGUAGES.UK,
        APP_LANGUAGES.EN
    ),
    notificationsEnabled: Joi.boolean().strict(),
}).min(1).unknown(false);
