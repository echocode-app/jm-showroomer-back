import Joi from "joi";

export const showroomSubmitSchema = Joi.object({}).unknown(false);

export const showroomSubmitParamsSchema = Joi.object({
    id: Joi.string().trim().required(),
}).unknown(false);
