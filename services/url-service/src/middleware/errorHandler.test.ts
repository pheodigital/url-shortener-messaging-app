import { Request, Response, NextFunction } from "express";
import { ZodError, z } from "zod";
import { AppError, errorHandler, notFound } from "./errorHandler";

// ─── Helpers ──────────────────────────────────────────────
const mockReq = (overrides = {}): Partial<Request> => ({
  method: "GET",
  originalUrl: "/test",
  ...overrides,
});

const mockRes = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = (): NextFunction => jest.fn();

// ─── AppError class ───────────────────────────────────────
describe("AppError", () => {
  it("should create error with correct message and status", () => {
    const error = new AppError("Not found", 404);

    expect(error.message).toBe("Not found");
    expect(error.status).toBe(404);
    expect(error.name).toBe("AppError");
  });

  it("should default status to 500 if not provided", () => {
    const error = new AppError("Something went wrong");

    expect(error.status).toBe(500);
  });
});

// ─── notFound handler ─────────────────────────────────────
describe("notFound handler", () => {
  it("should return 404 with route info in message", () => {
    const req = mockReq({ method: "GET", originalUrl: "/unknown" });
    const res = mockRes();
    const next = mockNext();

    notFound(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        message: expect.stringContaining("/unknown"),
      }),
    );
  });
});

// ─── errorHandler ─────────────────────────────────────────
describe("errorHandler", () => {
  it("should return correct status and message for AppError", () => {
    const err = new AppError("URL not found", 404);
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        message: "URL not found",
      }),
    );
  });

  it("should return 400 with field errors for ZodError", () => {
    // Generate a real ZodError by parsing invalid data
    const schema = z.object({ url: z.string().url() });
    let zodError!: ZodError;

    try {
      schema.parse({ url: "not-a-url" });
    } catch (e) {
      zodError = e as ZodError;
    }

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    errorHandler(zodError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        message: "Validation failed",
        errors: expect.any(Object),
      }),
    );
  });

  it("should return 500 and never leak internal error details", () => {
    const err = new Error("Something secret crashed");
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);

    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.status).toBe("error");
    expect(jsonCall.message).toBe("Internal server error");

    // Must never expose the real error message to the client
    expect(jsonCall.message).not.toContain("Something secret crashed");
  });
});
