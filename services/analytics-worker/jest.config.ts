import type { Config } from "jest";

// ─── Set env vars BEFORE Jest loads any modules ───────────
process.env["NODE_ENV"] = process.env["NODE_ENV"] ?? "test";
process.env["MONGODB_URI"] =
  process.env["MONGODB_URI"] ?? "mongodb://localhost:27017/test";
process.env["RABBITMQ_URL"] =
  process.env["RABBITMQ_URL"] ?? "amqp://localhost:5672";
process.env["RABBITMQ_QUEUE_CLICK_EVENTS"] =
  process.env["RABBITMQ_QUEUE_CLICK_EVENTS"] ?? "click_events";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  transform: { "^.+\\.ts$": "ts-jest" },
  clearMocks: true,
};

export default config;
