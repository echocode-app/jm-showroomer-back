import { badRequest } from "../../core/error.js";
import { addMonths } from "../../utils/date.js";
import { normalizeShowroomName } from "../../utils/showroomValidation.js";

const SHOWROOM_RECREATE_COOLDOWN_MONTHS = 3;

export function assertNoOwnerRecreateCooldown(
    items = [],
    { ownerUid, showroomId = null, normalizedName, now = new Date() } = {}
) {
    if (!ownerUid || !normalizedName) return;

    const nowDate = now instanceof Date ? now : new Date(now);
    if (!Number.isFinite(nowDate.getTime())) return;

    for (const item of items) {
        if (!item || item.id === showroomId) continue;
        if (item.ownerUid !== ownerUid) continue;
        if (item.status !== "deleted") continue;

        const itemNormalizedName =
            item.nameNormalized ?? normalizeShowroomName(item.name || "");
        if (itemNormalizedName !== normalizedName) continue;
        if (!item.deletedAt) continue;

        let cooldownEnd;
        try {
            cooldownEnd = addMonths(item.deletedAt, SHOWROOM_RECREATE_COOLDOWN_MONTHS);
        } catch {
            continue;
        }

        if (nowDate < cooldownEnd) {
            const err = badRequest("SHOWROOM_RECREATE_COOLDOWN");
            err.meta = {
                nextAvailableAt: cooldownEnd.toISOString(),
            };
            throw err;
        }
    }
}

