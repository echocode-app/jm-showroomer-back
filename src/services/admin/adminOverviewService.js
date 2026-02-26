import { getFirestoreInstance } from "../../config/firebase.js";
import { ROLES } from "../../constants/roles.js";

const LAST_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function getAdminOverviewService(now = new Date()) {
    const db = getFirestoreInstance();
    const currentTime = now instanceof Date ? now : new Date(now);
    const sevenDaysAgo = new Date(currentTime.getTime() - LAST_7_DAYS_MS);

    const showrooms = db.collection("showrooms");
    const events = db.collection("events");
    const users = db.collection("users");

    const [
        showroomTotal,
        showroomPending,
        showroomApproved,
        showroomRejected,
        showroomDeleted,
        showroomNewLast7Days,
        eventTotal,
        eventUpcoming,
        eventPast,
        eventNewLast7Days,
        userTotal,
        userOwners,
        userNewLast7Days,
    ] = await Promise.all([
        countQuery(showrooms),
        countQuery(showrooms.where("status", "==", "pending")),
        countQuery(showrooms.where("status", "==", "approved")),
        countQuery(showrooms.where("status", "==", "rejected")),
        countQuery(showrooms.where("status", "==", "deleted")),
        countQuery(showrooms.where("createdAt", ">=", sevenDaysAgo)),
        countQuery(events),
        countQuery(events.where("startsAt", ">=", currentTime)),
        countQuery(events.where("startsAt", "<", currentTime)),
        countQuery(events.where("createdAt", ">=", sevenDaysAgo)),
        countQuery(users),
        countQuery(users.where("role", "==", ROLES.OWNER)),
        countQuery(users.where("createdAt", ">=", sevenDaysAgo)),
    ]);

    return {
        showrooms: {
            total: showroomTotal,
            pending: showroomPending,
            approved: showroomApproved,
            rejected: showroomRejected,
            deleted: showroomDeleted,
            newLast7Days: showroomNewLast7Days,
        },
        events: {
            total: eventTotal,
            upcoming: eventUpcoming,
            past: eventPast,
            newLast7Days: eventNewLast7Days,
        },
        users: {
            total: userTotal,
            owners: userOwners,
            newLast7Days: userNewLast7Days,
        },
    };
}

async function countQuery(query) {
    const snap = await query.count().get();
    return Number(snap?.data?.().count || 0);
}
