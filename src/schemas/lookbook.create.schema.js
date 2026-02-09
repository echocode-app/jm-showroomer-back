// Joi schema: lookbook.create.
import Joi from "joi";

// Minimal create payload for MVP2 readiness.
export const lookbookCreateSchema = Joi.object({
    name: Joi.string().allow("", null),
    description: Joi.string().allow("", null),
    published: Joi.boolean().optional(),
}).unknown(false);
