import { Request, Response } from "express";
import prisma from "../config/database";
import logger from "../config/logger";
import { AppError } from "../middleware/errorHandler";

// ─── Redirect ─────────────────────────────────────────────
// GET /:shortcode
//
// This is the HOT PATH — the most called endpoint in the system.
// Every single click on a short URL hits this handler.
//
// Current flow (PR-05 — no cache yet):
//   1. Query PostgreSQL for shortcode
//   2. Return 302 redirect
//
// Optimised flow (PR-08 — Redis cache added):
//   1. Check Redis cache first (~2ms)
//   2. Cache HIT  → return 302 immediately
//   3. Cache MISS → query PostgreSQL (~50ms) → cache result → return 302
//
// HTTP 302 vs 301:
//   301 = Permanent redirect — browser caches it forever
//         Bad for us: if URL is deleted, browser still redirects
//   302 = Temporary redirect — browser always asks us first
//         Good for us: we stay in control of every redirect
export const redirect = async (req: Request, res: Response): Promise<void> => {
  const { shortcode } = req.params;

  // ── ADD THESE 3 LINES TEMPORARILY ───────────────────────
  console.log("## PRISMA IS: ##", typeof prisma);
  console.log("## PRISMA.URL IS: ##", typeof prisma?.url);
  console.log("## FINDUNIQUE IS: ##", typeof prisma?.url?.findUnique);
  // ── END TEMP LOGS ────────────────────────────────────────

  // ── Query database ───────────────────────────────────────
  // In PR-08 this becomes: check Redis first, then DB on miss
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
  // 410 Gone is more accurate than 404 here —
  // it tells the client this resource existed but is now gone
  if (!url.isActive) {
    throw new AppError("Short URL has been deleted", 410);
  }

  // ── Publish click event ──────────────────────────────────
  // Added in PR-15 — fire and forget to RabbitMQ
  // publishClickEvent({ shortcode, ip, userAgent, timestamp })

  logger.info("Redirecting", {
    shortcode,
    longUrl: url.longUrl,
  });

  // ── Redirect ─────────────────────────────────────────────
  res.redirect(302, url.longUrl);
};
