// ─── Mocks must be declared before any imports ────────────
const mockPrisma = {
  url: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../config/database", () => ({
  __esModule: true, // ← tells Jest this is an ES module
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: mockPrisma, // ← prisma client default export
}));

jest.mock("../../config/redis", () => ({
  __esModule: true,
  connectRedis: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue("ok"),
  getRedis: jest.fn(),
}));

import request from "supertest";
import app from "../../app";

// ─── POST /api/urls ───────────────────────────────────────
describe("POST /api/urls", () => {
  it("should create a short URL and return 201", async () => {
    mockPrisma.url.create.mockResolvedValue({
      id: "test-uuid-001",
      shortcode: "abc1234",
      longUrl: "https://www.google.com",
      isActive: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      userId: null,
    });

    const res = await request(app)
      .post("/api/urls")
      .send({ longUrl: "https://www.google.com" });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.shortcode).toBeDefined();
    expect(res.body.data.shortUrl).toContain(res.body.data.shortcode);
    expect(res.body.data.longUrl).toBe("https://www.google.com");
  });

  it("should return 400 when longUrl is missing", async () => {
    const res = await request(app).post("/api/urls").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors.longUrl).toBeDefined();
  });

  it("should return 400 when longUrl is not a valid URL", async () => {
    const res = await request(app)
      .post("/api/urls")
      .send({ longUrl: "not-a-url" });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors.longUrl).toBeDefined();
  });

  it("should return 409 when custom code is already taken", async () => {
    mockPrisma.url.findUnique.mockResolvedValue({
      id: "existing-id",
      shortcode: "taken",
    });

    const res = await request(app)
      .post("/api/urls")
      .send({ longUrl: "https://www.google.com", customCode: "taken" });

    expect(res.statusCode).toBe(409);
    expect(res.body.status).toBe("error");
  });
});

// ─── GET /api/urls ────────────────────────────────────────
describe("GET /api/urls", () => {
  it("should return list of URLs with 200", async () => {
    mockPrisma.url.findMany.mockResolvedValue([
      {
        id: "uuid-1",
        shortcode: "abc1234",
        longUrl: "https://google.com",
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "uuid-2",
        shortcode: "xyz5678",
        longUrl: "https://github.com",
        createdAt: new Date("2026-01-02"),
      },
    ]);

    const res = await request(app).get("/api/urls");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0].shortUrl).toBeDefined();
  });

  it("should return empty array when no URLs exist", async () => {
    mockPrisma.url.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/urls");

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.count).toBe(0);
  });
});

// ─── DELETE /api/urls/:id ─────────────────────────────────
describe("DELETE /api/urls/:id", () => {
  it("should soft delete a URL and return 200", async () => {
    mockPrisma.url.findUnique.mockResolvedValue({
      id: "uuid-1",
      shortcode: "abc1234",
      isActive: true,
    });

    mockPrisma.url.update.mockResolvedValue({
      id: "uuid-1",
      isActive: false,
    });

    const res = await request(app).delete("/api/urls/uuid-1");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("URL deleted successfully");
  });

  it("should return 404 when URL does not exist", async () => {
    mockPrisma.url.findUnique.mockResolvedValue(null);

    const res = await request(app).delete("/api/urls/nonexistent-id");

    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
  });

  it("should return 410 when URL is already deleted", async () => {
    mockPrisma.url.findUnique.mockResolvedValue({
      id: "uuid-1",
      shortcode: "abc1234",
      isActive: false,
    });

    const res = await request(app).delete("/api/urls/uuid-1");

    expect(res.statusCode).toBe(410);
    expect(res.body.status).toBe("error");
  });
});
