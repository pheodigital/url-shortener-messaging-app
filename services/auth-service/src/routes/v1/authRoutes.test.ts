// ─── Mocks must be declared before any imports ────────────
jest.mock("../../config/database", () => ({
  __esModule: true,
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../config/passport", () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn((_strategy: string, _options: object) =>
      jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    ),
    use: jest.fn(),
    serializeUser: jest.fn(),
    deserializeUser: jest.fn(),
    initialize: jest.fn(() =>
      jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    ),
  },
}));

import request from "supertest";
import app from "../../app";
import { signToken } from "../../config/jwt";

const db = require("../../config/database");
const mockPrisma = db.default;

// ─── GET /auth/google ─────────────────────────────────────
describe("GET /auth/google", () => {
  it("should return 401 on failed OAuth callback", async () => {
    const res = await request(app).get("/auth/failed");
    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Google authentication failed");
  });
});

// ─── GET /auth/me ─────────────────────────────────────────
describe("GET /auth/me", () => {
  it("should return 200 with user when JWT is valid", async () => {
    const mockUser = {
      id: "user-uuid-1",
      email: "test@example.com",
      name: "Test User",
      googleId: "google-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock DB lookup in authenticate middleware
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

    // Generate a real JWT for the test user
    const token = signToken({ userId: mockUser.id, email: mockUser.email });

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.user.email).toBe("test@example.com");
    expect(res.body.data.user.name).toBe("Test User");
  });

  it("should return 401 when no token provided", async () => {
    const res = await request(app).get("/auth/me");

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("No token provided");
  });

  it("should return 401 when token is invalid", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalid.token.here");

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Invalid or expired token");
  });

  it("should return 401 when user no longer exists in DB", async () => {
    // Valid JWT but user deleted from DB
    const token = signToken({
      userId: "deleted-user",
      email: "gone@example.com",
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("User no longer exists");
  });
});

// ─── POST /auth/logout ────────────────────────────────────
describe("POST /auth/logout", () => {
  it("should return 200 when authenticated user logs out", async () => {
    const mockUser = {
      id: "user-uuid-1",
      email: "test@example.com",
      name: "Test User",
      googleId: "google-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

    const token = signToken({ userId: mockUser.id, email: mockUser.email });

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("should return 401 when logging out without token", async () => {
    const res = await request(app).post("/auth/logout");

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
  });
});
