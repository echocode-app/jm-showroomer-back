import Joi from "joi";

export const userDeviceRegisterSchema = Joi.object({
    deviceId: Joi.string().trim().min(1).max(200).required(),
    fcmToken: Joi.string().trim().min(1).max(4096).required(),
    platform: Joi.string().valid("ios", "android").required(),
    appVersion: Joi.string().trim().max(100).allow("", null),
    locale: Joi.string().trim().max(20).allow("", null),
}).unknown(false);

export const userDeviceParamsSchema = Joi.object({
    deviceId: Joi.string().trim().min(1).max(200).required(),
}).unknown(false);
