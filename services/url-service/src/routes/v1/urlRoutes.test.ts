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
  warmCache: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";

// ─── Test JWT ─────────────────────────────────────────────
// Generate a valid token for tests using the same secret
// url-service uses to verify tokens
const TEST_USER = { userId: "test-user-id", email: "test@example.com" };
const TEST_TOKEN = jwt.sign(
  TEST_USER,
  process.env["JWT_ACCESS_SECRET"] ?? "test-secret-that-is-at-least-32-chars!!",
);

const authHeader = `Bearer ${TEST_TOKEN}`;

// ─── POST /api/urls ───────────────────────────────────────
describe("POST /api/urls — create URL", () => {
  it("should return 201 when authenticated with valid URL", async () => {
    mockPrisma.url.create.mockResolvedValueOnce({
      id: "url-uuid",
      shortcode: "abc1234",
      longUrl: "https://www.google.com",
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/urls")
      .set("Authorization", authHeader)
      .send({ longUrl: "https://www.google.com" });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.shortcode).toBeDefined();
  });

  it("should return 401 when no token provided", async () => {
    const res = await request(app)
      .post("/api/urls")
      .send({ longUrl: "https://www.google.com" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  it("should return 400 when longUrl is missing", async () => {
    const res = await request(app)
      .post("/api/urls")
      .set("Authorization", authHeader)
      .send({});

    expect(res.statusCode).toBe(400);
  });

  it("should return 400 when longUrl is not a valid URL", async () => {
    const res = await request(app)
      .post("/api/urls")
      .set("Authorization", authHeader)
      .send({ longUrl: "not-a-url" });

    expect(res.statusCode).toBe(400);
  });

  it("should return 409 when customCode is already taken", async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce({
      id: "existing",
      shortcode: "taken",
    });

    const res = await request(app)
      .post("/api/urls")
      .set("Authorization", authHeader)
      .send({ longUrl: "https://www.google.com", customCode: "taken" });

    expect(res.statusCode).toBe(409);
  });
});

// ─── GET /api/urls ────────────────────────────────────────
describe("GET /api/urls — list URLs", () => {
  it("should return 200 with user's URLs when authenticated", async () => {
    mockPrisma.url.findMany.mockResolvedValueOnce([
      {
        id: "url-uuid",
        shortcode: "abc1234",
        longUrl: "https://google.com",
        createdAt: new Date(),
      },
    ]);

    const res = await request(app)
      .get("/api/urls")
      .set("Authorization", authHeader);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.count).toBe(1);
  });

  it("should return 401 when no token provided", async () => {
    const res = await request(app).get("/api/urls");
    expect(res.statusCode).toBe(401);
  });

  it("should return 200 with empty array when user has no URLs", async () => {
    mockPrisma.url.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/urls")
      .set("Authorization", authHeader);

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);
  });
});

// ─── DELETE /api/urls/:id ─────────────────────────────────
describe("DELETE /api/urls/:id — delete URL", () => {
  it("should return 200 when authenticated user deletes their URL", async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce({
      id: "url-uuid",
      shortcode: "abc1234",
      isActive: true,
      userId: "test-user-id", // ← matches TEST_USER.userId
    });
    mockPrisma.url.update.mockResolvedValueOnce({
      id: "url-uuid",
      isActive: false,
    });

    const res = await request(app)
      .delete("/api/urls/url-uuid")
      .set("Authorization", authHeader);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("should return 403 when user tries to delete another user's URL", async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce({
      id: "url-uuid",
      shortcode: "abc1234",
      isActive: true,
      userId: "different-user-id", // ← does not match TEST_USER.userId
    });

    const res = await request(app)
      .delete("/api/urls/url-uuid")
      .set("Authorization", authHeader);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("should return 401 when no token provided", async () => {
    const res = await request(app).delete("/api/urls/url-uuid");
    expect(res.statusCode).toBe(401);
  });

  it("should return 404 when URL does not exist", async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .delete("/api/urls/nonexistent")
      .set("Authorization", authHeader);

    expect(res.statusCode).toBe(404);
  });
});
