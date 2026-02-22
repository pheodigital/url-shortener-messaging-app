import { Request, Response } from "express";
import { signToken } from "../config/jwt";
import { AppError } from "../middleware/errorHandler";
import { User } from "@prisma/client";
import logger from "../config/logger";

// ─── Google OAuth Callback ────────────────────────────────
// GET /auth/google/callback
//
// Called by Passport after Google OAuth succeeds.
// req.user is populated by passport.ts GoogleStrategy done() call.
//
// Flow:
//   1. Passport has already found/created the user in DB
//   2. We sign a JWT containing userId and email
//   3. Return the JWT to the client
//
// In production you would set the JWT in an httpOnly cookie
// For now we return it in the response body for simplicity
// Cookie approach added when we wire up the frontend
export const googleCallback = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const user = req.user as User;

  if (!user) {
    throw new AppError("Authentication failed", 401);
  }

  // Sign JWT with userId and email
  const token = signToken({
    userId: user.id,
    email: user.email,
  });

  logger.info("JWT issued", { userId: user.id, email: user.email });

  // Return token in response body
  // Frontend stores this and sends it as:
  // Authorization: Bearer <token> on every request
  res.status(200).json({
    status: "success",
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
  });
};

// ─── Get Current User ─────────────────────────────────────
// GET /auth/me
//
// Returns the currently authenticated user.
// req.user is populated by the authenticate middleware (PR-12)
// which verifies the JWT from the Authorization header.
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as User;

  if (!user) {
    throw new AppError("Not authenticated", 401);
  }

  res.status(200).json({
    status: "success",
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
  });
};

// ─── Logout ───────────────────────────────────────────────
// POST /auth/logout
//
// JWTs are stateless — we cannot invalidate them server-side
// without a token blacklist (Redis based — added later if needed).
//
// For now logout is client-side only:
//   Client deletes the JWT from localStorage/cookie
//   Server confirms the logout request was received
//
// This is acceptable for most use cases.
// If you need immediate token invalidation:
//   Store JWT ID (jti) in Redis blacklist on logout
//   Check blacklist on every request in authenticate middleware
export const logout = async (req: Request, res: Response): Promise<void> => {
  // If using httpOnly cookies:
  // res.clearCookie("token");

  logger.info("User logged out", { userId: (req.user as User)?.id });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully — please delete your token",
  });
};
