import request from "supertest";
import app from "../../index";

// ─── Health Endpoint ──────────────────────────────────────
describe("GET /health", () => {
  it("should return 200 with status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("url-service");
    expect(res.body.timestamp).toBeDefined();
  });

  it("should return a valid ISO timestamp", async () => {
    const res = await request(app).get("/health");
    const date = new Date(res.body.timestamp as string);
    expect(date.toString()).not.toBe("Invalid Date");
  });
});

// ─── 404 Handler ─────────────────────────────────────────
describe("404 handler", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await request(app).get("/unknown-route-xyz");

    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("not found");
  });
});
