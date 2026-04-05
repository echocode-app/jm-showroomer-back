import Joi from "joi";

export const authOauthSchema = Joi.object({
    idToken: Joi.string().trim().min(1).required(),
})
    .unknown(false)
    .default({});
