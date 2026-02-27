import jwt from "jsonwebtoken";
import env from "./env";
import logger from "./logger";

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

// ─── Verify Access Token ──────────────────────────────────
// analytics-service only verifies tokens — never signs them
// Same secret as auth-service and url-service
export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch (error) {
    logger.debug("Access token verification failed", { error });
    return null;
  }
};
