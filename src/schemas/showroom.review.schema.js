import Joi from "joi";

export const showroomReviewSchema = Joi.object({
    reason: Joi.string().trim().min(3).required(),
}).unknown(false);
