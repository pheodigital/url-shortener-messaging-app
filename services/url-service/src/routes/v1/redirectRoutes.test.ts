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

// ─── Mock clickPublisher ──────────────────────────────────
// We test that publishClickEvent is called — not that RabbitMQ
// actually receives the message (that is clickPublisher's concern)
jest.mock("../../config/clickPublisher", () => ({
  publishClickEvent: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import app from "../../app";
import * as cache from "../../config/cache";
import * as clickPublisher from "../../config/clickPublisher";
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

    // DB should NOT be called on cache hit
    expect(mockPrisma.url.findUnique).not.toHaveBeenCalled();

    // Click event should be published on cache HIT
    expect(clickPublisher.publishClickEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shortcode: "abc1234",
        longUrl: "https://www.google.com",
        timestamp: expect.any(String),
        ip: expect.any(String),
        userAgent: expect.any(String),
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
    expect(res.headers["location"]).toBe("https://www.google.com");

    // Cache should be populated after DB lookup
    expect(cache.setCachedUrl).toHaveBeenCalledWith(
      "abc1234",
      "https://www.google.com",
    );

    // Click event should be published on cache MISS too
    expect(clickPublisher.publishClickEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shortcode: "abc1234",
        longUrl: "https://www.google.com",
      }),
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

    const res = await request(app)
      .get("/api/urls")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
  });
});
