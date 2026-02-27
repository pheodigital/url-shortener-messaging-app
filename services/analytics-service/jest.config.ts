import type { Config } from "jest";

// ─── Set env vars BEFORE Jest loads any modules ───────────
process.env["NODE_ENV"] = "test";
process.env["MONGODB_URI"] = "mongodb://localhost:27017/test";
process.env["JWT_ACCESS_SECRET"] = "test-secret-that-is-at-least-32-chars!!";
process.env["ALLOWED_ORIGIN"] = "http://localhost:3000";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts", "**/*.spec.ts"], // ✅ Co-located tests
  moduleFileExtensions: ["ts", "js"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/server.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  // setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^.*/config/database$": "<rootDir>/src/config/database.ts",
  },
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  setupFiles: ["<rootDir>/src/__tests__/setup.ts"],
  // ✅ REMOVED invalid mockResetManager
  clearMocks: true, // ✅ Resets mocks between tests
  // resetMocks: true, // ✅ Resets all mocks before each test
  restoreMocks: true, // ✅ Restores original implementations
};

export default config;
