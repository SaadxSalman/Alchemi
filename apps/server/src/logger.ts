/**
 * Structured logging with Pino.
 * In dev: pretty-printed, colorized output via pino-pretty.
 * In prod: newline-delimited JSON for ingestion by ELK / Loki / CloudWatch.
 */
import pino from "pino";
import { env } from "./env";

const isDev = env.nodeEnv === "development";

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    base: {
      service: "alchemi-server",
      version: "1.0.0",
      env: env.nodeEnv,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers['x-api-key']",
        "req.headers.cookie",
        "*.password",
        "*.token",
        "*.secret",
      ],
      censor: "[redacted]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,service",
          singleLine: false,
          messageFormat: "{msg}",
        },
      })
    : undefined
);

/** Child logger for a specific request — attaches requestId for tracing. */
export const reqLogger = (requestId: string) =>
  logger.child({ requestId });
