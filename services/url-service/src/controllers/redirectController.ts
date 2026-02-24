import { Request, Response } from "express";
import prisma from "../config/database";
import { getCachedUrl, setCachedUrl } from "../config/cache";
import { publishClickEvent } from "../config/clickPublisher";
import logger from "../config/logger";
import { AppError } from "../middleware/errorHandler";

// ─── Redirect ─────────────────────────────────────────────
// GET /:shortcode
//
// HOT PATH — every click on a short URL hits this handler.
//
// Flow:
//   1. Check Redis cache (~2ms)
//   2. Cache HIT  → publish click event → 302 redirect
//   3. Cache MISS → query PostgreSQL (~50ms)
//              → cache result
//              → publish click event
//              → 302 redirect
//
// Click events are published AFTER redirect is sent
// so analytics never slow down or break the redirect
export const redirect = async (req: Request, res: Response): Promise<void> => {
  const { shortcode } = req.params;

  if (!shortcode) {
    throw new AppError("Shortcode is required", 400);
  }

  // ── Extract request metadata for analytics ───────────────
  const ip = req.ip ?? "unknown";
  const userAgent = req.get("user-agent") ?? "unknown";
  const timestamp = new Date().toISOString();

  // ── Step 1: Check Redis cache ────────────────────────────
  const cached = await getCachedUrl(shortcode);

  if (cached) {
    logger.info("Redirect via cache", { shortcode });

    // ── Publish click event — fire and forget ────────────
    // res.redirect() is called first — publish never blocks it
    // publishClickEvent never throws — safe to call always
    void publishClickEvent({
      shortcode,
      longUrl: cached,
      timestamp,
      ip,
      userAgent,
    });

    res.redirect(302, cached);
    return;
  }

  // ── Step 2: Cache MISS — query PostgreSQL ────────────────
  const url = await prisma.url.findUnique({
    where: { shortcode },
    select: {
      longUrl: true,
      isActive: true,
    },
  });

  if (!url) {
    throw new AppError("Short URL not found", 404);
  }

  if (!url.isActive) {
    throw new AppError("Short URL has been deleted", 410);
  }

  // ── Step 3: Cache for next request ───────────────────────
  await setCachedUrl(shortcode, url.longUrl);

  logger.info("Redirect via database", { shortcode });

  // ── Publish click event — fire and forget ─────────────
  void publishClickEvent({
    shortcode,
    longUrl: url.longUrl,
    timestamp,
    ip,
    userAgent,
  });

  // ── Step 4: Redirect ─────────────────────────────────────
  res.redirect(302, url.longUrl);
};
