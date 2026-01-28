import { createShowroom } from "../services/showroomService.js";
import { ok } from "../utils/apiResponse.js";

export async function createShowroomController(req, res, next) {
    try {
        const ownerUid = req.user.uid;
        const data = req.body;

        const showroom = await createShowroom(data, ownerUid);

        return ok(res, { showroom });
    } catch (err) {
        next(err);
    }
}

export async function listShowrooms(req, res, next) {
    try {
        const db = getFirestoreInstance();
        const snapshot = await db.collection("showrooms").get();
        const showrooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return ok(res, { showrooms });
    } catch (err) {
        next(err);
    }
}

export async function favoriteShowroom(req, res, next) {
    try {
        // TODO: додати логіку фаворитів
        return ok(res, { message: "Added to favorites", user: req.user });
    } catch (err) {
        next(err);
    }
}
