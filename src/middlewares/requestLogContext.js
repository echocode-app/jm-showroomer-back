// Request log context helpers: attach actorId without touching auth/user business state.

function getHeaderValue(headers, name) {
  const value = headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function deriveActorId(req) {
  if (req?.auth?.uid) return `u:${req.auth.uid}`;

  const anonymousId = getHeaderValue(req?.headers, "x-anonymous-id").trim();
  if (anonymousId) return `a:${anonymousId}`;

  return undefined;
}

export function attachActorLogContext(req) {
  if (!req?.log) return;
  if (!req._baseLog) {
    req._baseLog = req.log;
  }

  const actorId = deriveActorId(req);
  if (!actorId) return;
  if (req._logActorId === actorId) return;

  req.log = req._baseLog.child({ actorId });
  req._logActorId = actorId;
}

export function requestLogContextMiddleware(req, res, next) {
  attachActorLogContext(req);
  next();
}
