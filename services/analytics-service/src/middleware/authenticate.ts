import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../config/jwt";
import { AppError } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

// ─── Authenticate Middleware ──────────────────────────────
// Same pattern as url-service — verifies JWT, attaches payload
// No DB lookup needed — userId comes from token directly
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("No token provided", 401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError("No token provided", 401);
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new AppError("Invalid or expired token", 401);
    }

    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};
