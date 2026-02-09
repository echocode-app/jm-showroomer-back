// Joi schema: event.rsvp.
import Joi from "joi";

// RSVP requires only event id in params.
export const eventRsvpSchema = Joi.object({
    id: Joi.string().required(),
}).unknown(false);
