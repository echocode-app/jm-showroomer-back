const VIEW_WINDOW_MS = 10_000;
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
    return true;
}

export function __resetViewThrottleForTests() {
    viewCache.clear();
}

