import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import logger from "../config/logger";

export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

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

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      status: "error",
      message: err.message,
    });
    return;
  }

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
