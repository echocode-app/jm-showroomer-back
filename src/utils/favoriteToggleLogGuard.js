const TOGGLE_DEBOUNCE_MS = 300;
const toggleCache = new Map();

function compactCache(now) {
  if (toggleCache.size < 500) return;

  for (const [key, ts] of toggleCache.entries()) {
    if (now - ts > TOGGLE_DEBOUNCE_MS * 10) {
      toggleCache.delete(key);
    }
  }
}

export function shouldEmitFavoriteToggleLog(actorId, resourceType, resourceId) {
  if (!actorId || !resourceType || !resourceId) return true;

  const now = Date.now();
  compactCache(now);

  const key = `${actorId}:${resourceType}:${resourceId}`;
  const previousTs = toggleCache.get(key);
  toggleCache.set(key, now);

  if (typeof previousTs !== "number") return true;
  return now - previousTs >= TOGGLE_DEBOUNCE_MS;
}
