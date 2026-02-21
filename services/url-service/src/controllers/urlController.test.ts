// ─── Mocks must be declared before any imports ────────────
// From src/controllers/ → one level up → src/config/
const mockPrisma = {
  url: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../config/database", () => ({
  __esModule: true,
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue("ok"),
  default: mockPrisma,
}));

jest.mock("../config/redis", () => ({
  __esModule: true,
  connectRedis: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue("ok"),
  getRedis: jest.fn(),
}));

jest.mock("../config/cache", () => ({
  getCachedUrl: jest.fn().mockResolvedValue(null),
  setCachedUrl: jest.fn().mockResolvedValue(undefined),
  invalidateCachedUrl: jest.fn().mockResolvedValue(undefined),
}));

import { Request, Response } from "express";
import { createUrl, listUrls, deleteUrl } from "./urlController";
import { AppError } from "../middleware/errorHandler";
import * as cache from "../config/cache";

// ─── Helpers ──────────────────────────────────────────────
const mockReq = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  params: {},
  ...overrides,
});

const mockRes = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// ─── createUrl ────────────────────────────────────────────
describe("createUrl controller", () => {
  it("should create a URL and return 201 with shortUrl", async () => {
    mockPrisma.url.create.mockResolvedValue({
      id: "test-uuid",
      shortcode: "abc1234",
      longUrl: "https://www.google.com",
      createdAt: new Date("2026-01-01"),
    });

    const req = mockReq({ body: { longUrl: "https://www.google.com" } });
    const res = mockRes();

    await createUrl(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          shortcode: "abc1234",
          longUrl: "https://www.google.com",
          shortUrl: expect.stringContaining("abc1234"),
        }),
      }),
    );
  });

  it("should throw AppError 409 when customCode is already taken", async () => {
    mockPrisma.url.findUnique.mockResolvedValue({
      id: "existing",
      shortcode: "taken",
    });

    const req = mockReq({
      body: { longUrl: "https://www.google.com", customCode: "taken" },
    });
    const res = mockRes();

    await expect(createUrl(req as Request, res as Response)).rejects.toThrow(
      AppError,
    );

    await expect(
      createUrl(req as Request, res as Response),
    ).rejects.toMatchObject({ status: 409 });
  });
});

// ─── listUrls ─────────────────────────────────────────────
describe("listUrls controller", () => {
  it("should return 200 with list of URLs including shortUrl", async () => {
    mockPrisma.url.findMany.mockResolvedValue([
      {
        id: "uuid-1",
        shortcode: "abc1234",
        longUrl: "https://google.com",
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const req = mockReq();
    const res = mockRes();

    await listUrls(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        count: 1,
        data: expect.arrayContaining([
          expect.objectContaining({
            shortcode: "abc1234",
            shortUrl: expect.stringContaining("abc1234"),
          }),
        ]),
      }),
    );
  });

  it("should return 200 with empty array when no URLs exist", async () => {
    mockPrisma.url.findMany.mockResolvedValue([]);

    const req = mockReq();
    const res = mockRes();

    await listUrls(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        count: 0,
        data: [],
      }),
    );
  });
});

// ─── deleteUrl ────────────────────────────────────────────
describe("deleteUrl controller", () => {
  it("should soft delete URL and invalidate cache", async () => {
    mockPrisma.url.findUnique.mockResolvedValue({
      id: "uuid-1",
      shortcode: "abc1234",
      isActive: true,
    });
    mockPrisma.url.update.mockResolvedValue({
      id: "uuid-1",
      isActive: false,
    });

    const req = mockReq({ params: { id: "uuid-1" } });
    const res = mockRes();

    await deleteUrl(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        message: "URL deleted successfully",
      }),
    );

    // Verify soft delete
    expect(mockPrisma.url.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );

    // Verify cache invalidation — key must be removed on delete
    expect(cache.invalidateCachedUrl).toHaveBeenCalledWith("abc1234");
  });

  it("should throw AppError 404 when URL does not exist", async () => {
    mockPrisma.url.findUnique.mockResolvedValue(null);

    const req = mockReq({ params: { id: "nonexistent" } });
    const res = mockRes();

    await expect(deleteUrl(req as Request, res as Response)).rejects.toThrow(
      AppError,
    );

    await expect(
      deleteUrl(req as Request, res as Response),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("should throw AppError 410 when URL is already deleted", async () => {
    mockPrisma.url.findUnique.mockResolvedValue({
      id: "uuid-1",
      shortcode: "abc1234",
      isActive: false,
    });

    const req = mockReq({ params: { id: "uuid-1" } });
    const res = mockRes();

    await expect(deleteUrl(req as Request, res as Response)).rejects.toThrow(
      AppError,
    );

    await expect(
      deleteUrl(req as Request, res as Response),
    ).rejects.toMatchObject({ status: 410 });
  });
});
