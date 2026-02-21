// ─── Mocks must be declared before any imports ────────────
jest.mock("../../config/database", () => ({
  __esModule: true,
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: {
    url: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../config/redis", () => ({
  __esModule: true,
  connectRedis: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue("ok"),
  getRedis: jest.fn(),
  default: null,
}));

import request from "supertest";
import app from "../../app";

// ─── Health Endpoint — all dependencies ok ────────────────
describe("GET /health — database ok", () => {
  it("should return 200 when postgres and redis are healthy", async () => {
    const res = await request(app).get("/health");

    console.log("STATUS:", res.statusCode);
    console.log("BODY:", JSON.stringify(res.body));
    console.log("TEXT:", res.text);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("url-service");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.dependencies.postgres).toBe("ok");
    expect(res.body.dependencies.redis).toBe("ok");
  });

  it("should return a valid ISO timestamp", async () => {
    const res = await request(app).get("/health");
    const date = new Date(res.body.timestamp as string);
    expect(date.toString()).not.toBe("Invalid Date");
  });
});

// ─── Health Endpoint — postgres down ─────────────────────
describe("GET /health — database down", () => {
  it("should return 503 when postgres is down", async () => {
    const db = require("../../config/database");
    db.checkDatabaseHealth.mockResolvedValueOnce("error");

    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.postgres).toBe("error");
  });
});

// ─── Health Endpoint — redis down ────────────────────────
describe("GET /health — redis down", () => {
  it("should return 503 when redis is down", async () => {
    const redis = require("../../config/redis");
    redis.checkRedisHealth.mockResolvedValueOnce("error");

    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.redis).toBe("error");
  });
});

// ─── 404 handler ─────────────────────────────────────────
describe("404 handler", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await request(app).get("/unknown-route-xyz");
    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
  });
});
