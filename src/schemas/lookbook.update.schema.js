import Joi from "joi";

export const lookbookUpdateSchema = Joi.object({
    imageUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }),
    showroomId: Joi.string().trim(),
    description: Joi.alternatives().try(
        Joi.string().trim().max(1000),
        Joi.valid(null)
    ),
}).min(1).unknown(false);
