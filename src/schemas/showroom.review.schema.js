// Joi schema: showroom review validation rules.

import Joi from "joi";

// Admin review requires a short reason (min 3 chars).
export const showroomReviewSchema = Joi.object({
    reason: Joi.string().trim().min(3).required(),
}).unknown(false);
