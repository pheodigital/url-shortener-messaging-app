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

import request from "supertest";
import app from "../../app";

describe("GET /health — database ok", () => {
  it("should return 200 when postgres is healthy", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("url-service");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.dependencies.postgres).toBe("ok");
  });

  it("should return a valid ISO timestamp", async () => {
    const res = await request(app).get("/health");
    const date = new Date(res.body.timestamp as string);
    expect(date.toString()).not.toBe("Invalid Date");
  });
});

describe("GET /health — database down", () => {
  it("should return 503 when postgres is down", async () => {
    // ─── from src/routes/v1/ → up 2 levels → src/ → config/database
    const db = require("../../config/database");
    db.checkDatabaseHealth.mockResolvedValueOnce("error");

    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.postgres).toBe("error");
  });
});

describe("404 handler", () => {
  it("should return 404 for unknown routes", async () => {
    // findUnique returns null → redirect controller throws 404 AppError
    // which is then caught by errorHandler and returned as 404
    const db = require("../../config/database");
    db.default.url.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get("/unknown-route-xyz");
    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
  });
});
