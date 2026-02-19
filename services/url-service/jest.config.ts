import type { Config } from "jest";

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
  },
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  // ✅ REMOVED invalid mockResetManager
  clearMocks: true, // ✅ Resets mocks between tests
  resetMocks: true, // ✅ Resets all mocks before each test
  restoreMocks: true, // ✅ Restores original implementations
};

export default config;
