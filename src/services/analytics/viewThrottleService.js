// Anti-storm throttle for detail view analytics (per-instance, in-memory).
// Policy: allow max 1 emit per actor+resource within a 10s window; clear cache on overflow for MVP safety.
const VIEW_WINDOW_MS = 10_000;
const MAX_CACHE_SIZE = 10_000;
const viewCache = new Map();

export function shouldEmitView(actorId, resourceType, resourceId) {
    const actor = String(actorId || "").trim();
    const type = String(resourceType || "").trim();
    const id = String(resourceId || "").trim();
    if (!actor || !type || !id) return true;

    const key = `${actor}:${type}:${id}`;
    const now = Date.now();
    const last = viewCache.get(key);

    if (last && now - last < VIEW_WINDOW_MS) {
        return false;
    }

    viewCache.set(key, now);
    if (viewCache.size > MAX_CACHE_SIZE) {
        viewCache.clear();
    }
    return true;
}

export function __resetViewThrottleForTests() {
    viewCache.clear();
}
