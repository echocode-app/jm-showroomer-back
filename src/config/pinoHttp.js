import crypto from "node:crypto";

export function buildPinoHttpConfig(logger) {
  return {
    logger,
    autoLogging: false,
    quietReqLogger: true,
    quietResLogger: true,
    customAttributeKeys: {
      reqId: "requestId",
      responseTime: "duration",
    },
    genReqId(req, res) {
      const incoming = req.headers["x-request-id"];
      const requestId =
        typeof incoming === "string" && incoming.trim()
          ? incoming
          : crypto.randomUUID();
      res.setHeader("x-request-id", requestId);
      return requestId;
    },
  };
}
