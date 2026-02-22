import { Request, Response } from "express";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../config/jwt";
import { AppError } from "../middleware/errorHandler";
import { User } from "@prisma/client";
import prisma from "../config/database";
import logger from "../config/logger";

// ─── Google OAuth Callback ────────────────────────────────
// GET /auth/google/callback
//
// Issues BOTH tokens after successful Google OAuth:
//   accessToken  → short lived (15min), used for every API request
//   refreshToken → long lived (7 days), used to get new access tokens
//
// refreshToken is stored in DB so logout can invalidate it
export const googleCallback = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const user = req.user as User;

  if (!user) {
    throw new AppError("Authentication failed", 401);
  }

  // ── Issue both tokens ────────────────────────────────────
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
  });

  const refreshToken = signRefreshToken(user.id);

  // ── Store refresh token in DB ────────────────────────────
  // Enables server-side logout by deleting this value
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  logger.info("Tokens issued", { userId: user.id, email: user.email });

  res.status(200).json({
    status: "success",
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
  });
};

// ─── Refresh Access Token ─────────────────────────────────
// POST /auth/refresh
// Body: { refreshToken: string }
//
// Flow:
//   1. Verify refresh token signature
//   2. Look up user in DB — verify stored refresh token matches
//   3. Issue new access token
//   4. Return new access token (refresh token stays the same)
//
// Why verify against DB?
//   After logout the refresh token is deleted from DB.
//   Even if attacker has the refresh token, DB check fails → 401
export const refresh = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  // ── Verify refresh token signature ───────────────────────
  const payload = verifyRefreshToken(refreshToken);

  if (!payload) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // ── Verify token matches what is stored in DB ────────────
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError("Refresh token has been revoked", 401);
  }

  // ── Issue new access token ───────────────────────────────
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
  });

  logger.info("Access token refreshed", { userId: user.id });

  res.status(200).json({
    status: "success",
    data: {
      accessToken,
    },
  });
};

// ─── Get Current User ─────────────────────────────────────
// GET /auth/me
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
// TRUE server-side logout — deletes refresh token from DB
// After this:
//   - Existing access token works until it expires (15min max)
//   - POST /auth/refresh returns 401 — no new access tokens possible
//   - User is effectively logged out within 15 minutes
//
// For immediate logout: reduce access token TTL or implement
// a Redis-based token blacklist (future enhancement)
export const logout = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as User;

  // ── Delete refresh token from DB ─────────────────────────
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: null },
  });

  logger.info("User logged out", { userId: user.id });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};
