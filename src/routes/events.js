import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadUser } from "../middlewares/loadUser.js";
import { schemaValidate } from "../middlewares/schemaValidate.js";
import { eventRsvpSchema } from "../schemas/event.rsvp.schema.js";
import { rsvpEvent } from "../controllers/eventController.js";

const router = Router();

router.post(
    "/:id/rsvp",
    authMiddleware,
    loadUser,
    schemaValidate({ params: eventRsvpSchema }),
    rsvpEvent
);

export default router;
