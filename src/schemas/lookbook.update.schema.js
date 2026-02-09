// Joi schema: lookbook.update.
import Joi from "joi";

// Minimal update payload; at least one field required.
export const lookbookUpdateSchema = Joi.object({
    name: Joi.string().allow("", null),
    description: Joi.string().allow("", null),
    published: Joi.boolean().optional(),
}).min(1).unknown(false);
