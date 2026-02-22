import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import logger from "../config/logger";

// ─── AppError ─────────────────────────────────────────────
// Typed operational error with HTTP status code
// Thrown from controllers for expected error conditions
export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ─── Not Found Handler ────────────────────────────────────
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
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // ZodError — validation failed
  if (err instanceof ZodError) {
    const errors = err.flatten().fieldErrors;
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors,
    });
    return;
  }

  // AppError — known operational error
  if (err instanceof AppError) {
    res.status(err.status).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  // Unknown error — never leak details to client
  logger.error(err.message, {
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
  });

  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};
