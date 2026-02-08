// Joi schema: showroom submit validation rules.

import Joi from "joi";

// Submit body must be empty.
export const showroomSubmitSchema = Joi.object({}).unknown(false);

// Path params require a valid id.
export const showroomSubmitParamsSchema = Joi.object({
    id: Joi.string().trim().required(),
}).unknown(false);
