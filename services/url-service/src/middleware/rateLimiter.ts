import { Request, Response, NextFunction } from "express";
import { getRedis } from "../config/redis";
import { AppError } from "./errorHandler";
import logger from "../config/logger";

// ─── Rate Limiter Factory ─────────────────────────────────
// Creates a rate limiter middleware with configurable limits
//
// Algorithm: Redis INCR + TTL (sliding window counter)
//
//   Every request:
//     1. INCR key          → atomically increment counter
//     2. If count === 1    → EXPIRE key windowMs/1000 (first request sets window)
//     3. If count > limit  → return 429 with Retry-After header
//     4. Otherwise         → next()
//
// Why INCR is safe:
//   Redis INCR is atomic — no race condition between
//   check and increment. Two concurrent requests cannot
//   both read 0 and both think they are the first request.
//
// Why not express-rate-limit?
//   We want to understand the internals + full control
//   over the Redis key structure and error behaviour.
const createRateLimiter = (options: {
  windowMs: number; // time window in milliseconds
  max: number; // max requests per window
  keyPrefix: string; // "rl:ip" or "rl:user"
  keyFn: (req: Request) => string; // extracts the key from request
  message?: string;
}) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const redis = getRedis();
      const windowSecs = Math.floor(options.windowMs / 1000);
      const identifier = options.keyFn(req);
      const key = `${options.keyPrefix}:${identifier}`;

      // ── INCR — atomic increment ──────────────────────────
      const count = await redis.incr(key);

      // ── Set TTL on first request ─────────────────────────
      // Only set expiry when count is 1 to avoid resetting
      // the window on every request
      if (count === 1) {
        await redis.expire(key, windowSecs);
      }

      // ── Get remaining TTL for Retry-After header ─────────
      const ttl = await redis.ttl(key);

      // ── Set rate limit headers ───────────────────────────
      res.setHeader("X-RateLimit-Limit", options.max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, options.max - count));
      res.setHeader("X-RateLimit-Reset", Date.now() + ttl * 1000);

      // ── Check limit ──────────────────────────────────────
      if (count > options.max) {
        res.setHeader("Retry-After", ttl);

        logger.warn("Rate limit exceeded", {
          key,
          count,
          limit: options.max,
          ttl,
        });

        throw new AppError(options.message ?? "Too many requests", 429);
      }

      next();
    } catch (error) {
      // ── Fail open — if Redis is down, allow the request ──
      // Rate limiting is important but not critical
      // A Redis outage should not take down the entire service
      if (error instanceof AppError) {
        next(error);
        return;
      }

      logger.error("Rate limiter error — failing open", { error });
      next();
    }
  };
};

// ─── Redirect Rate Limiter ────────────────────────────────
// GET /:shortcode → 300 req/min per IP
//
// Keyed by IP address — public route, no user context
// 300/min = 5 req/sec per IP — reasonable for humans
// Protects against scraping and redirect abuse
export const redirectLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  keyPrefix: "rl:ip",
  keyFn: (req) => req.ip ?? "unknown",
  message: "Too many requests — please slow down",
});

// ─── API Rate Limiter ─────────────────────────────────────
// POST /api/urls → 60 req/min per user
// GET  /api/urls → 60 req/min per user
// DELETE /api/urls/:id → 60 req/min per user
//
// Keyed by userId from JWT — authenticated route
// 60/min = 1 req/sec per user — prevents URL spam
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: "rl:user",
  keyFn: (req) => req.user?.userId ?? req.ip ?? "unknown",
  message: "Too many requests — please slow down",
});
