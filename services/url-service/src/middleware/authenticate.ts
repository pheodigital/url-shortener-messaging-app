import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../config/jwt";
import { AppError } from "./errorHandler";

// ─── Extend Express Request ───────────────────────────────
// Adds userId and email to req so controllers can access them
// without another DB lookup — payload already contains what we need
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

// ─── Authenticate Middleware ──────────────────────────────
// Protects all /api/urls routes in url-service
//
// Key difference from auth-service authenticate:
//   auth-service → looks up full User from DB (needs user object)
//   url-service  → only needs userId from token payload
//                  no DB lookup needed — faster on the hot path
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    // ── Extract token ────────────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("No token provided", 401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError("No token provided", 401);
    }

    // ── Verify token ─────────────────────────────────────
    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new AppError("Invalid or expired token", 401);
    }

    // ── Attach payload to request ────────────────────────
    // Controllers access userId via req.user.userId
    req.user = payload;

    next();
  } catch (error) {
    next(error);
  }
};
