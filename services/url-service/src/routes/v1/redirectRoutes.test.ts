// ─── Mocks must be declared before any imports ────────────
// jest.mock is hoisted to the top by Jest automatically
// moduleNameMapper in jest.config.js ensures "../config/database"
// and "../../config/database" resolve to the same mock
const mockPrisma = {
  url: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../config/database", () => ({
  __esModule: true,
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: mockPrisma,
}));

import request from "supertest";
import app from "../../app";

// ─── GET /:shortcode ──────────────────────────────────────
describe("GET /:shortcode — redirect", () => {
  it("should return 302 and redirect to longUrl", async () => {
    (mockPrisma.url.findUnique as jest.Mock).mockResolvedValue({
      longUrl: "https://www.google.com",
      isActive: true,
    });

    const res = await request(app).get("/abc1234");

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe("https://www.google.com");
  });

  it("should return 404 when shortcode does not exist", async () => {
    (mockPrisma.url.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get("/doesnotexist");

    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Short URL not found");
  });

  it("should return 410 when URL has been soft deleted", async () => {
    (mockPrisma.url.findUnique as jest.Mock).mockResolvedValue({
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
    (mockPrisma.url.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get("/api/urls");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
  });
});
