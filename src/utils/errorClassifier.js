const DOMAIN_VALIDATION_CODES = new Set([
  "AUTH_INVALID",
  "VALIDATION_ERROR",
  "QUERY_INVALID",
  "CURSOR_INVALID",
  "SHOWROOM_NAME_INVALID",
  "PHONE_INVALID",
]);

const BUSINESS_BLOCKED_CODES = new Set([
  "ACCESS_DENIED",
  "FORBIDDEN",
  "COUNTRY_BLOCKED",
  "USER_DELETE_BLOCKED",
  "SHOWROOM_LOCKED_PENDING",
  "RATE_LIMIT_EXCEEDED",
]);

function getStatus(err) {
  if (!err || typeof err !== "object") return undefined;
  const status = err.status ?? err.statusCode ?? err.httpStatus;
  return typeof status === "number" ? status : undefined;
}

function getCode(err) {
  if (!err || typeof err !== "object") return "";
  return typeof err.code === "string" ? err.code.trim() : "";
}

function isFirebaseStyleCode(code) {
  return /^(auth|app|firestore|messaging|storage|functions|database)\/[a-z0-9-]+$/i.test(
    code
  );
}

export function classifyError(err) {
  const status = getStatus(err);
  const code = getCode(err);

  if (status === 400 || DOMAIN_VALIDATION_CODES.has(code)) {
    return {
      category: "domain_validation",
      level: "warn",
    };
  }

  if (status === 403 || status === 409 || status === 429 || BUSINESS_BLOCKED_CODES.has(code)) {
    return {
      category: "business_blocked",
      level: "warn",
    };
  }

  if (status === 500 || status === 503 || isFirebaseStyleCode(code) || err instanceof Error) {
    return {
      category: "infra",
      level: "error",
    };
  }

  return {
    category: "unknown",
    level: "error",
  };
}
