import Joi from "joi";

export const lookbookCreateSchema = Joi.object({
    imageUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).required(),
    showroomId: Joi.string().trim().required(),
    description: Joi.string().trim().max(1000).optional(),
}).unknown(false);
