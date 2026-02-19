import { createLogger, format, transports } from "winston";
import env from "./env";

const { combine, timestamp, errors, json, colorize, printf } = format;

// ─── Development Format ───────────────────────────────────
// Human-readable colored output for local dev
const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length) log += ` ${JSON.stringify(meta)}`;
    if (stack) log += `\n${stack}`;
    return log;
  }),
);

// ─── Production Format ────────────────────────────────────
// Structured JSON — easy to parse by Grafana, Datadog, CloudWatch etc.
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

// ─── Logger Instance ──────────────────────────────────────
const logger = createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: env.NODE_ENV === "production" ? prodFormat : devFormat,
  defaultMeta: { service: "url-service" },
  transports: [new transports.Console()],
  exitOnError: false,
});

export default logger;
