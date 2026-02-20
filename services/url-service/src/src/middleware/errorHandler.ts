import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import logger from "../config/logger";

// ─── Custom Error Type ────────────────────────────────────
// Extends the built-in Error with an optional HTTP status code.
// Usage: throw new AppError("Not found", 404)
export class AppError extends Error {
  constructor(
    public message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ─── Not Found Handler ────────────────────────────────────
// Catches any request that didn't match a route
export const notFound = (
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

// ─── Global Error Handler ─────────────────────────────────
// Must have exactly 4 params for Express to treat it as error middleware
export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Log the full error internally — always
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  // Zod validation errors (from request body validation)
  if (err instanceof ZodError) {
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // Our own AppError (known, operational errors)
  if (err instanceof AppError) {
    res.status(err.status).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  // Unknown errors — never leak stack traces to the client
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};
