import Joi from "joi";

const lookbookAuthorSchema = Joi.object({
    name: Joi.string().trim().min(1).max(120).required(),
    position: Joi.string().trim().min(1).max(120).optional(),
    instagram: Joi.string().trim().uri({ scheme: ["http", "https"] }).optional(),
}).unknown(false);

const lookbookItemSchema = Joi.object({
    name: Joi.string().trim().min(1).max(120).required(),
    link: Joi.string().trim().uri({ scheme: ["http", "https"] }).required(),
}).unknown(false);

export const lookbookUpdateSchema = Joi.object({
    imageUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }),
    showroomId: Joi.string().trim(),
    description: Joi.alternatives().try(
        Joi.string().trim().max(1000),
        Joi.valid(null)
    ),
    author: Joi.alternatives().try(
        lookbookAuthorSchema,
        Joi.valid(null)
    ),
    items: Joi.alternatives().try(
        Joi.array().items(lookbookItemSchema).max(30),
        Joi.valid(null)
    ),
}).min(1).unknown(false);
