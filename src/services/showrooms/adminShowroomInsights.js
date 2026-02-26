import { forbidden } from "../../core/error.js";
import { getShowroomByIdService } from "./getShowroomById.js";

export async function getAdminShowroomHistoryService(id, user) {
    assertAdmin(user);
    const showroom = await getShowroomByIdService(id, user);
    const history = buildSortedHistory(showroom?.editHistory);
    return {
        history,
        meta: {
            total: history.length,
        },
    };
}

export async function getAdminShowroomStatsService(id, user) {
    assertAdmin(user);
    const showroom = await getShowroomByIdService(id, user);
    const history = Array.isArray(showroom?.editHistory) ? showroom.editHistory : [];

    const moderation = {
        approveCount: countHistoryAction(history, "approve"),
        rejectCount: countHistoryAction(history, "reject"),
        submitCount: countHistoryAction(history, "submit"),
        lastReviewedAt: showroom?.reviewedAt ?? null,
        lastReviewedBy: showroom?.reviewedBy ?? null,
    };

    return {
        editCount: Number.isFinite(showroom?.editCount) ? showroom.editCount : 0,
        moderation,
        lifecycle: {
            createdAt: showroom?.createdAt ?? null,
            lastUpdatedAt: showroom?.updatedAt ?? null,
            currentStatus: showroom?.status ?? null,
        },
    };
}

function assertAdmin(user) {
    if (user?.role !== "admin") {
        throw forbidden("FORBIDDEN");
    }
}

function countHistoryAction(history, action) {
    return history.reduce(
        (count, entry) => count + (entry?.action === action ? 1 : 0),
        0
    );
}

function buildSortedHistory(history) {
    if (!Array.isArray(history)) return [];
    return [...history].sort((left, right) => {
        const a = parseHistoryAt(left?.at);
        const b = parseHistoryAt(right?.at);
        if (a === b) return 0;
        return b - a;
    });
}

function parseHistoryAt(value) {
    if (typeof value === "string") {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
    }
    if (value && typeof value?.toDate === "function") {
        const date = value.toDate();
        if (date instanceof Date) return date.getTime();
    }
    return Number.NEGATIVE_INFINITY;
}

