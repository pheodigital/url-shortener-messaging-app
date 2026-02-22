import jwt from "jsonwebtoken";
import env from "./env";
import logger from "./logger";

// ─── Payloads ─────────────────────────────────────────────
export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

// ─── Sign Access Token ────────────────────────────────────
// Short lived — 15 minutes by default
// Contains userId + email so protected routes don't need a DB lookup
// for basic user info
export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
};

// ─── Sign Refresh Token ───────────────────────────────────
// Long lived — 7 days by default
// Contains only userId — minimal payload
// Signed with a DIFFERENT secret so a compromised access token
// secret cannot be used to forge refresh tokens
export const signRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
};

// ─── Verify Access Token ──────────────────────────────────
// Called on every protected request
// Returns null if invalid or expired — never throws
export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch (error) {
    logger.debug("Access token verification failed", { error });
    return null;
  }
};

// ─── Verify Refresh Token ─────────────────────────────────
// Called only on POST /auth/refresh
// Uses different secret from access token
export const verifyRefreshToken = (
  token: string,
): RefreshTokenPayload | null => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (error) {
    logger.debug("Refresh token verification failed", { error });
    return null;
  }
};

// ─── Backward Compatibility ───────────────────────────────
// Keep signToken and verifyToken as aliases
// so existing code does not break during migration
export const signToken = signAccessToken;
export const verifyToken = verifyAccessToken;
