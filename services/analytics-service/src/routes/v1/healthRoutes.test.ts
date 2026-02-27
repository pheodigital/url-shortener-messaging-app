// ─── Mocks must be declared before any imports ────────────
jest.mock("../../config/mongodb", () => ({
  __esModule: true,
  connectMongoDB: jest.fn().mockResolvedValue(undefined),
  checkMongoDBHealth: jest.fn().mockReturnValue("ok"),
  disconnectMongoDB: jest.fn().mockResolvedValue(undefined),
  default: { connection: { readyState: 1 } },
}));

import request from "supertest";
import app from "../../app";

describe("GET /health — mongodb ok", () => {
  it("should return 200 when mongodb is healthy", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("analytics-service");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.dependencies.mongodb).toBe("ok");
  });

  it("should return a valid ISO timestamp", async () => {
    const res = await request(app).get("/health");
    const date = new Date(res.body.timestamp as string);
    expect(date.toString()).not.toBe("Invalid Date");
  });
});

describe("GET /health — mongodb down", () => {
  it("should return 503 when mongodb is down", async () => {
    const db = require("../../config/mongodb");
    db.checkMongoDBHealth.mockReturnValueOnce("error");

    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.mongodb).toBe("error");
  });
});

describe("404 handler", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await request(app).get("/unknown-route-xyz");
    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
  });
});
