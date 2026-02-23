import crypto from "node:crypto";

const isDev = process.env.NODE_ENV === "dev";

export function buildPinoHttpConfig(logger) {
  return {
    logger,
    genReqId(req, res) {
      const incoming = req.headers["x-request-id"];
      const requestId =
        typeof incoming === "string" && incoming.trim()
          ? incoming
          : crypto.randomUUID();
      res.setHeader("x-request-id", requestId);
      return requestId;
    },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    ...(isDev
      ? {
          customSuccessMessage(req, res) {
            return `${req.method} ${req.url} -> ${res.statusCode}`;
          },
          customErrorMessage(req, res) {
            return `${req.method} ${req.url} -> ${res.statusCode}`;
          },
        }
      : {}),
    customProps(req) {
      return {
        requestId: req.id,
      };
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body",
      ],
      remove: true,
    },
    autoLogging: {
      ignore(req) {
        return req.url?.startsWith("/health") || req.url?.startsWith("/api/v1/health");
      },
    },
  };
}

