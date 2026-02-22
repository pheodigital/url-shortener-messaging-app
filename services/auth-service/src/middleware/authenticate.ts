import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../config/jwt";
import prisma from "../config/database";
import { AppError } from "./errorHandler";

// ─── Authenticate Middleware ──────────────────────────────
// Protects routes that require a valid access token
//
// Flow:
//   1. Reads access token from Authorization: Bearer <token>
//   2. Verifies JWT signature and expiry
//   3. Looks up user in DB to ensure they still exist
//   4. Attaches user to req.user → controller runs
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
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

    // ── Verify access token ──────────────────────────────
    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new AppError("Invalid or expired token", 401);
    }

    // ── Look up user ─────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError("User no longer exists", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
