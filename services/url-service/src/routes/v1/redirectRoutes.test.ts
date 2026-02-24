import jwt from "jsonwebtoken";
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

jest.mock("../../config/rabbitmq", () => ({
  __esModule: true,
  connectRabbitMQ: jest.fn().mockResolvedValue(undefined),
  checkRabbitMQHealth: jest.fn().mockReturnValue("ok"), // ← mockReturnValue not mockResolvedValue
  getChannel: jest.fn(),
  disconnectRabbitMQ: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock cache helpers ───────────────────────────────────
// Cache is mocked at the helper level — we test the controller
// logic not the Redis commands themselves
jest.mock("../../config/cache", () => ({
  getCachedUrl: jest.fn().mockResolvedValue(null), // default: cache MISS
  setCachedUrl: jest.fn().mockResolvedValue(undefined),
  invalidateCachedUrl: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import app from "../../app";
import * as cache from "../../config/cache";

// ─── GET /:shortcode ──────────────────────────────────────
describe("GET /:shortcode — redirect", () => {
  it("should return 302 via cache HIT without querying DB", async () => {
    // Simulate cache HIT — longUrl found in Redis
    (cache.getCachedUrl as jest.Mock).mockResolvedValueOnce(
      "https://www.google.com",
    );

    const res = await request(app).get("/abc1234");

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe("https://www.google.com");

    // DB should NOT be called on cache hit
    expect(mockPrisma.url.findUnique).not.toHaveBeenCalled();
  });

  it("should return 302 via DB on cache MISS and populate cache", async () => {
    // Cache MISS — falls through to DB
    (cache.getCachedUrl as jest.Mock).mockResolvedValueOnce(null);

    mockPrisma.url.findUnique.mockResolvedValueOnce({
      longUrl: "https://www.google.com",
      isActive: true,
    });

    const res = await request(app).get("/abc1234");

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe("https://www.google.com");

    // Cache should be populated after DB lookup
    expect(cache.setCachedUrl).toHaveBeenCalledWith(
      "abc1234",
      "https://www.google.com",
    );
  });

  it("should return 404 when shortcode does not exist", async () => {
    (cache.getCachedUrl as jest.Mock).mockResolvedValueOnce(null);
    mockPrisma.url.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get("/doesnotexist");

    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
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
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Short URL has been deleted");
  });

  it("should not interfere with /health route", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe("url-service");
  });

  it("should not interfere with /api/urls route", async () => {
    mockPrisma.url.findMany.mockResolvedValueOnce([]);

    const token = jwt.sign(
      { userId: "test-user-id", email: "test@example.com" },
      process.env["JWT_ACCESS_SECRET"] ??
        "test-secret-that-is-at-least-32-chars!!",
    );

    const res = await request(app)
      .get("/api/urls")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
  });
});
