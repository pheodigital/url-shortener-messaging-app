import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validate } from "./validate";

// ─── Test Schema ──────────────────────────────────────────
// Simple schema used only for testing the middleware itself
const testSchema = z.object({
  name: z.string({ required_error: "name is required" }),
  url: z.string().url("must be a valid URL"),
});

// ─── Helpers ──────────────────────────────────────────────
// Mock req, res, next — test middleware in pure isolation
// no Express server, no HTTP layer, no Supertest needed
const mockReq = (body: unknown): Partial<Request> => ({ body });
const mockRes = (): Partial<Response> => ({});
const mockNext = (): NextFunction => jest.fn();

// ─── Tests ───────────────────────────────────────────────
describe("validate() middleware", () => {
  it("should call next() with no error when body is valid", () => {
    const req = mockReq({ name: "Google", url: "https://www.google.com" });
    const res = mockRes();
    const next = mockNext();

    validate(testSchema)(req as Request, res as Response, next);

    // next() with no args = validation passed, move to controller
    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should call next() with ZodError when url is invalid", () => {
    const req = mockReq({ name: "Google", url: "not-a-url" });
    const res = mockRes();
    const next = mockNext();

    validate(testSchema)(req as Request, res as Response, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.name).toBe("ZodError");
  });

  it("should call next() with ZodError when required field is missing", () => {
    const req = mockReq({ url: "https://www.google.com" }); // name missing
    const res = mockRes();
    const next = mockNext();

    validate(testSchema)(req as Request, res as Response, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.name).toBe("ZodError");
  });

  it("should call next() with ZodError when body is empty", () => {
    const req = mockReq({});
    const res = mockRes();
    const next = mockNext();

    validate(testSchema)(req as Request, res as Response, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.name).toBe("ZodError");
  });

  it("should replace req.body with the parsed and cleaned data", () => {
    const req = mockReq({
      name: "Google",
      url: "https://www.google.com",
    });
    const res = mockRes();
    const next = mockNext();

    validate(testSchema)(req as Request, res as Response, next);

    // req.body is now the Zod-parsed result
    expect(req.body).toEqual({
      name: "Google",
      url: "https://www.google.com",
    });
  });
});
