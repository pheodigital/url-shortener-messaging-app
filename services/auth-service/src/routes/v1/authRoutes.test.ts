// ─── Mocks must be declared before any imports ────────────
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../config/database", () => ({
  __esModule: true,
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: mockPrisma,
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
import { signAccessToken, signRefreshToken } from "../../config/jwt";

// ─── GET /auth/failed ─────────────────────────────────────
describe("GET /auth/failed", () => {
  it("should return 401 on failed OAuth", async () => {
    const res = await request(app).get("/auth/failed");
    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Google authentication failed");
  });
});

// ─── GET /auth/me ─────────────────────────────────────────
describe("GET /auth/me", () => {
  it("should return 200 with user when access token is valid", async () => {
    const mockUser = {
      id: "user-uuid-1",
      email: "test@example.com",
      name: "Test User",
      googleId: "google-123",
      refreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

    const token = signAccessToken({
      userId: mockUser.id,
      email: mockUser.email,
    });

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.user.email).toBe("test@example.com");
  });

  it("should return 401 when no token provided", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  it("should return 401 when token is invalid", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  it("should return 401 when user no longer exists in DB", async () => {
    const token = signAccessToken({
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

// ─── POST /auth/refresh ───────────────────────────────────
describe("POST /auth/refresh", () => {
  it("should return new access token when refresh token is valid", async () => {
    const mockUser = {
      id: "user-uuid-1",
      email: "test@example.com",
      name: "Test User",
      googleId: "google-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const refreshToken = signRefreshToken(mockUser.id);

    // DB returns user with matching refresh token
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      refreshToken,
    });

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("should return 400 when refresh token is missing", async () => {
    const res = await request(app).post("/auth/refresh").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Refresh token is required");
  });

  it("should return 401 when refresh token is invalid", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "invalid.token.here" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid or expired refresh token");
  });

  it("should return 401 when refresh token has been revoked", async () => {
    const refreshToken = signRefreshToken("user-uuid-1");

    // DB returns user with DIFFERENT refresh token (revoked)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-uuid-1",
      email: "test@example.com",
      refreshToken: "different-token", // ← does not match
    });

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Refresh token has been revoked");
  });
});

// ─── POST /auth/logout ────────────────────────────────────
describe("POST /auth/logout", () => {
  it("should return 200 and delete refresh token from DB", async () => {
    const mockUser = {
      id: "user-uuid-1",
      email: "test@example.com",
      name: "Test User",
      googleId: "google-123",
      refreshToken: "some-refresh-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
    mockPrisma.user.update.mockResolvedValueOnce({
      ...mockUser,
      refreshToken: null,
    });

    const token = signAccessToken({
      userId: mockUser.id,
      email: mockUser.email,
    });

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");

    // Verify refresh token was deleted from DB
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { refreshToken: null },
      }),
    );
  });

  it("should return 401 when logging out without token", async () => {
    const res = await request(app).post("/auth/logout");
    expect(res.statusCode).toBe(401);
  });
});
