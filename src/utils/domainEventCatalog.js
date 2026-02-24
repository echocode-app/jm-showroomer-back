export const DOMAIN_EVENTS = {
  auth: ["login"],
  user: ["delete"],
  showroom: ["create", "submit", "delete", "favorite"],
  lookbook: ["create", "delete", "favorite"],
  moderation: ["approve", "reject"],
  event: ["want_to_visit", "dismiss"],
  sync: ["favorites_sync", "events_sync"],
  system: ["rate_limit", "index_not_ready"],
};

export function isCatalogEvent(domain, event) {
  if (typeof domain !== "string" || typeof event !== "string") return false;
  const allowed = DOMAIN_EVENTS[domain];
  return Array.isArray(allowed) && allowed.includes(event);
}

