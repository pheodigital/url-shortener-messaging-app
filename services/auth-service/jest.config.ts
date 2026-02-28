import type { Config } from "jest";

// ─── Set env vars BEFORE Jest loads any modules ───────────
process.env["NODE_ENV"] = process.env["NODE_ENV"] ?? "test";
process.env["JWT_ACCESS_SECRET"] =
  process.env["JWT_ACCESS_SECRET"] ?? "test-secret-that-is-at-least-32-chars!!";
process.env["JWT_REFRESH_SECRET"] =
  process.env["JWT_REFRESH_SECRET"] ??
  "test-refresh-secret-at-least-32-chars!!";
process.env["GOOGLE_CLIENT_ID"] =
  process.env["GOOGLE_CLIENT_ID"] ?? "test-google-client-id";
process.env["GOOGLE_CLIENT_SECRET"] =
  process.env["GOOGLE_CLIENT_SECRET"] ?? "test-google-client-secret";
process.env["GOOGLE_CALLBACK_URL"] =
  process.env["GOOGLE_CALLBACK_URL"] ??
  "http://localhost:3001/auth/google/callback";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js"],
  transform: { "^.+\\.ts$": "ts-jest" },
  clearMocks: true,
  moduleNameMapper: {
    "^.*/config/database$": "<rootDir>/src/config/database.ts",
  },
};

export default config;
