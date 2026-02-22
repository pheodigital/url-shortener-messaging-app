import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../config/jwt";
import prisma from "../config/database";
import { AppError } from "./errorHandler";

// ─── Authenticate Middleware ──────────────────────────────
// Protects routes that require a valid JWT
//
// How it works:
//   1. Reads token from Authorization header: "Bearer <token>"
//   2. Verifies JWT signature and expiry
//   3. Looks up user in DB to ensure they still exist
//   4. Attaches user to req.user
//   5. Calls next() → protected controller runs
//
// Used in PR-13 to protect url-service endpoints
// Used here to protect /auth/me
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // ── Extract token from header ────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("No token provided", 401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError("No token provided", 401);
    }

    // ── Verify JWT signature ─────────────────────────────
    const payload = verifyToken(token);

    if (!payload) {
      throw new AppError("Invalid or expired token", 401);
    }

    // ── Look up user in DB ───────────────────────────────
    // Verify user still exists — they may have been deleted
    // since the token was issued
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError("User no longer exists", 401);
    }

    // ── Attach user to request ───────────────────────────
    // req.user is now available in the controller
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};
