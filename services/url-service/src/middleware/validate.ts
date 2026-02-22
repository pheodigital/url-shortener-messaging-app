import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

// ─── Validate Middleware ───────────────────────────────────
// A reusable middleware factory that takes any Zod schema
// and validates req.body against it.
//
// Usage in routes:
//   router.post("/", validate(createUrlSchema), urlController.create)
//
// If validation passes → calls next() → controller runs
// If validation fails  → calls next(error) → errorHandler formats the response
//
// This keeps controllers clean — they never need to validate manually.
// By the time a controller runs, req.body is guaranteed to be valid.

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // parse() throws ZodError if validation fails
      // It also TRANSFORMS the data (e.g. trimming strings)
      // and replaces req.body with the cleaned version
      req.body = schema.parse(req.body);
      next(); // next() is used to pass control to the next middleware or route handler
    } catch (error) {
      if (error instanceof ZodError) {
        // Pass to global errorHandler which formats ZodError responses
        next(error);
      } else {
        next(error);
      }
    }
  };
