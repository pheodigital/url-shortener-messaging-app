import { Request, Response } from "express";
import prisma from "../config/database";
import { getCachedUrl, setCachedUrl } from "../config/cache";
import logger from "../config/logger";
import { AppError } from "../middleware/errorHandler";

// ─── Redirect ─────────────────────────────────────────────
// GET /:shortcode
//
// This is the HOT PATH — the most called endpoint in the system.
// Every single click on a short URL hits this handler.
//
// Cache-aside pattern (PR-08):
//   1. Check Redis cache first (~2ms)
//   2. Cache HIT  → return 302 immediately — never touch DB
//   3. Cache MISS → query PostgreSQL (~50ms)
//              → cache result in Redis with 24h TTL
//              → return 302
//
// Why cache-aside and not write-through?
//   Cache-aside: populate cache on first miss
//   Write-through: populate cache on every write
//
//   Cache-aside is better here because:
//   - Most URLs are never clicked — no point caching everything
//   - Hot URLs (clicked often) get cached automatically on first hit
//   - Cache only contains what is actually being used
export const redirect = async (req: Request, res: Response): Promise<void> => {
  const { shortcode } = req.params;

  // ── Step 1: Check Redis cache ────────────────────────────
  // getCachedUrl never throws — returns null on any error
  // so a Redis outage never breaks redirects
  if (!shortcode) {
    throw new AppError("Shortcode is required", 400);
  }

  // Ignore browser favicon requests — not a real shortcode
  if (shortcode === "favicon.ico") {
    res.status(204).end();
    return;
  }

  const cached = await getCachedUrl(shortcode);

  if (cached) {
    // Cache HIT — respond immediately without touching DB
    logger.info("Redirect via cache", { shortcode });

    // Publish click event to RabbitMQ — added in PR-15
    // publishClickEvent({ shortcode, ip, userAgent, timestamp })

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

  // ── Not found ────────────────────────────────────────────
  if (!url) {
    throw new AppError("Short URL not found", 404);
  }

  // ── Soft deleted ─────────────────────────────────────────
  // 410 Gone — resource existed but has been removed
  if (!url.isActive) {
    throw new AppError("Short URL has been deleted", 410);
  }

  // ── Step 3: Store in cache for next request ──────────────
  // setCachedUrl never throws — fire and forget
  // The redirect happens regardless of cache write success
  await setCachedUrl(shortcode, url.longUrl);

  logger.info("Redirect via database", { shortcode });

  // Publish click event to RabbitMQ — added in PR-15
  // publishClickEvent({ shortcode, ip, userAgent, timestamp })

  // ── Step 4: Redirect ─────────────────────────────────────
  res.redirect(302, url.longUrl);
};
