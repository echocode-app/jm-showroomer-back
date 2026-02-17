import Joi from "joi";

// Author block is optional at payload level, but must be complete when provided.
const lookbookAuthorSchema = Joi.object({
    name: Joi.string().trim().min(1).max(120).required(),
    position: Joi.string().trim().min(1).max(120).optional(),
    instagram: Joi.string().trim().uri({ scheme: ["http", "https"] }).optional(),
}).unknown(false);

const lookbookItemSchema = Joi.object({
    name: Joi.string().trim().min(1).max(120).required(),
    link: Joi.string().trim().uri({ scheme: ["http", "https"] }).required(),
}).unknown(false);

export const lookbookCreateSchema = Joi.object({
    // Keep single-image `imageUrl` required for current MVP1 catalog cards.
    imageUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).required(),
    showroomId: Joi.string().trim().required(),
    description: Joi.string().trim().max(1000).optional(),
    author: lookbookAuthorSchema.optional(),
    items: Joi.array().items(lookbookItemSchema).max(30).optional(),
}).unknown(false);
