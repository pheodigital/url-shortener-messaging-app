import winston from "winston";
import env from "./env";

const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  defaultMeta: { service: "analytics-service" },
  format:
    env.NODE_ENV === "production"
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        )
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: "HH:mm:ss" }),
          winston.format.printf(
            ({ timestamp, level, message, ...meta }) =>
              `${timestamp} [${level}] ${message} ${
                Object.keys(meta).length && meta.service !== "analytics-service"
                  ? JSON.stringify(meta)
                  : ""
              }`,
          ),
        ),
  transports: [new winston.transports.Console()],
});

export default logger;
