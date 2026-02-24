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
}));

jest.mock("../../config/rabbitmq", () => ({
  __esModule: true,
  connectRabbitMQ: jest.fn().mockResolvedValue(undefined),
  checkRabbitMQHealth: jest.fn().mockReturnValue("ok"),
  getChannel: jest.fn(),
  disconnectRabbitMQ: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../config/cache", () => ({
  getCachedUrl: jest.fn().mockResolvedValue(null),
  setCachedUrl: jest.fn().mockResolvedValue(undefined),
  invalidateCachedUrl: jest.fn().mockResolvedValue(undefined),
  warmCache: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import app from "../../app";

// ─── All dependencies healthy ─────────────────────────────
describe("GET /health — all ok", () => {
  it("should return 200 when all dependencies are healthy", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("url-service");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.dependencies.postgres).toBe("ok");
    expect(res.body.dependencies.redis).toBe("ok");
    expect(res.body.dependencies.rabbitmq).toBe("ok");
  });

  it("should return a valid ISO timestamp", async () => {
    const res = await request(app).get("/health");
    const date = new Date(res.body.timestamp as string);
    expect(date.toString()).not.toBe("Invalid Date");
  });
});

// ─── Postgres down ────────────────────────────────────────
describe("GET /health — postgres down", () => {
  it("should return 503 when postgres is down", async () => {
    const db = require("../../config/database");
    db.checkDatabaseHealth.mockResolvedValueOnce("error");

    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.postgres).toBe("error");
  });
});

// ─── Redis down ───────────────────────────────────────────
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

// ─── RabbitMQ down ───────────────────────────────────────
describe("GET /health — rabbitmq down", () => {
  it("should return 503 when rabbitmq is down", async () => {
    const rabbit = require("../../config/rabbitmq");
    rabbit.checkRabbitMQHealth.mockReturnValueOnce("error");

    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.rabbitmq).toBe("error");
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
