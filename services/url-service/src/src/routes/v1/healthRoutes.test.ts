jest.mock("../../config/database", () => ({
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}));

import request from "supertest";
import app from "../../app";
// ADD THIS TEMPORARILY
import * as db from "../../config/database";

describe("GET /health — database ok", () => {
  it("should return 200 when postgres is healthy", async () => {
    // ADD THESE TWO LINES
    console.log("IS MOCKED:", jest.isMockFunction(db.checkDatabaseHealth));
    console.log("MOCK RETURN:", await db.checkDatabaseHealth());
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
    const res = await request(app).get("/unknown-route-xyz");
    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("not found");
  });
});
