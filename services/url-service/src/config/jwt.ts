import jwt from "jsonwebtoken";
import env from "./env";
import logger from "./logger";

// ─── Access Token Payload ─────────────────────────────────
// Must match exactly what auth-service puts inside the token
// auth-service signs it, url-service only verifies it
export interface AccessTokenPayload {
  userId: string;
  email: string;
}

// ─── Verify Access Token ──────────────────────────────────
// Called on every protected request in url-service
// Verifies the JWT was signed by auth-service using the shared secret
// Returns null if invalid or expired — never throws
//
// No signToken here — url-service never issues tokens
// Only auth-service signs tokens
export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  try {
    return jwt.verify(
      token,
      env.JWT_ACCESS_SECRET as string,
    ) as AccessTokenPayload;
  } catch (error) {
    logger.debug("Access token verification failed", { error });
    return null;
  }
};
