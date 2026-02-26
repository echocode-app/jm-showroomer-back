// Centralized structured logger (Pino) with backward-compatible `log.*` facade.
import pino from "pino";

const isDev = process.env.NODE_ENV === "dev";

const baseOptions = {
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
};

const devTransport = isDev
  ? {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: false,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    }
  : {};

export const logger = pino({
  ...baseOptions,
  ...devTransport,
});

// Keep existing imports working without touching business code.
export const log = logger;
log.success = (...args) => logger.info(...args);
