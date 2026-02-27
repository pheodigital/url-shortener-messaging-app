// ─── Mocks must be declared before any imports ────────────
const mockPrisma = {
  url: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
  },
};

jest.mock("../../config/database", () => ({
  __esModule: true,
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: mockPrisma,
}));

jest.mock("../../config/redis", () => ({
  __esModule: true,
  connectRedis: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue("ok"),
  getRedis: jest.fn(),
}));

jest.mock("../../config/cache", () => ({
  getCachedUrl: jest.fn().mockResolvedValue(null),
  setCachedUrl: jest.fn().mockResolvedValue(undefined),
  invalidateCachedUrl: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../config/rabbitmq", () => ({
  __esModule: true,
  connectRabbitMQ: jest.fn().mockResolvedValue(undefined),
  checkRabbitMQHealth: jest.fn().mockReturnValue("ok"),
  getChannel: jest.fn(),
  disconnectRabbitMQ: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../config/clickPublisher", () => ({
  publishClickEvent: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock rate limiter — pass through by default ──────────
// Tests focus on redirect logic not rate limiting
// Rate limiting is tested separately below
jest.mock("../../middleware/rateLimiter", () => ({
  redirectLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) =>
    next(),
  ),
  apiLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) =>
    next(),
  ),
}));

import request from "supertest";
import app from "../../app";
import * as cache from "../../config/cache";
import * as clickPublisher from "../../config/clickPublisher";
import * as rateLimiter from "../../middleware/rateLimiter";
import jwt from "jsonwebtoken";

const TEST_TOKEN = jwt.sign(
  { userId: "test-user-id", email: "test@example.com" },
  process.env["JWT_ACCESS_SECRET"] ?? "test-secret-that-is-at-least-32-chars!!",
);

// ─── GET /:shortcode ──────────────────────────────────────
describe("GET /:shortcode — redirect", () => {
  it("should return 302 via cache HIT and publish click event", async () => {
    (cache.getCachedUrl as jest.Mock).mockResolvedValueOnce(
      "https://www.google.com",
    );

    const res = await request(app).get("/abc1234");

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe("https://www.google.com");
    expect(mockPrisma.url.findUnique).not.toHaveBeenCalled();
    expect(clickPublisher.publishClickEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shortcode: "abc1234",
        longUrl: "https://www.google.com",
      }),
    );
  });

  it("should return 302 via DB on cache MISS and publish click event", async () => {
    (cache.getCachedUrl as jest.Mock).mockResolvedValueOnce(null);
    mockPrisma.url.findUnique.mockResolvedValueOnce({
      longUrl: "https://www.google.com",
      isActive: true,
    });

    const res = await request(app).get("/abc1234");

    expect(res.statusCode).toBe(302);
    expect(cache.setCachedUrl).toHaveBeenCalledWith(
      "abc1234",
      "https://www.google.com",
    );
    expect(clickPublisher.publishClickEvent).toHaveBeenCalled();
  });

  it("should return 404 when shortcode does not exist", async () => {
    (cache.getCachedUrl as jest.Mock).mockResolvedValueOnce(null);
    mockPrisma.url.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get("/doesnotexist");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Short URL not found");
  });

  it("should return 410 when URL has been soft deleted", async () => {
    (cache.getCachedUrl as jest.Mock).mockResolvedValueOnce(null);
    mockPrisma.url.findUnique.mockResolvedValueOnce({
      longUrl: "https://www.google.com",
      isActive: false,
    });

    const res = await request(app).get("/deletedcode");
    expect(res.statusCode).toBe(410);
  });

  it("should return 429 when rate limit is exceeded", async () => {
    // Override mock to simulate rate limit exceeded
    (rateLimiter.redirectLimiter as jest.Mock).mockImplementationOnce(
      (_req: unknown, _res: unknown, next: (err?: unknown) => void) => {
        const { AppError } = require("../../middleware/errorHandler");
        next(new AppError("Too many requests — please slow down", 429));
      },
    );

    const res = await request(app).get("/abc1234");
    expect(res.statusCode).toBe(429);
    expect(res.body.message).toBe("Too many requests — please slow down");
  });

  it("should not interfere with /health route", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe("url-service");
  });

  it("should not interfere with /api/urls route", async () => {
    mockPrisma.url.findMany.mockResolvedValueOnce([]);
    const res = await request(app)
      .get("/api/urls")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.statusCode).toBe(200);
  });
});
