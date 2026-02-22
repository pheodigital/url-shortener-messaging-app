import jwt from "jsonwebtoken";
import env from "./env";
import logger from "./logger";

// ─── JWT Payload ──────────────────────────────────────────
// What we store inside each token
// Keep it minimal — only what every request needs
export interface JwtPayload {
  userId: string;
  email: string;
}

// ─── Sign Token ───────────────────────────────────────────
// Creates a signed JWT containing the user's id and email
// Called once after Google OAuth callback succeeds
export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

// ─── Verify Token ─────────────────────────────────────────
// Verifies the JWT signature and returns the payload
// Returns null if token is invalid or expired — never throws
// Called on every protected request
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    logger.debug("JWT verification failed", { error });
    return null;
  }
};
