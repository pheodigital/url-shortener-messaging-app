import { Request, Response } from "express";
import { nanoid } from "nanoid";

import prisma from "../config/database";
import { invalidateCachedUrl, warmCache } from "../config/cache";
import env from "../config/env";
import logger from "../config/logger";
import { AppError } from "../middleware/errorHandler";
import { CreateUrlInput } from "../schemas/urlSchemas";

// ─── Create Short URL ─────────────────────────────────────
// POST /api/urls
// Body: { longUrl: string, customCode?: string }
export const createUrl = async (req: Request, res: Response): Promise<void> => {
  const { longUrl, customCode } = req.body as CreateUrlInput;

  let shortcode: string;

  if (customCode) {
    const existing = await prisma.url.findUnique({
      where: { shortcode: customCode },
    });

    if (existing) {
      throw new AppError(`Custom code '${customCode}' is already taken`, 409);
    }

    shortcode = customCode;
  } else {
    // nanoid(7) generates a random 7-character URL-safe shortcode
    // 7 chars = ~3.5 trillion combinations — collision extremely unlikely
    shortcode = nanoid(7);
  }

  const url = await prisma.url.create({ data: { shortcode, longUrl } });

  await warmCache(shortcode, longUrl);

  logger.info("URL created", { shortcode, longUrl });

  res.status(201).json({
    status: "success",
    data: {
      id: url.id,
      shortcode: url.shortcode,
      shortUrl: `${env.BASE_URL}/${url.shortcode}`,
      longUrl: url.longUrl,
      createdAt: url.createdAt,
    },
  });
};

// ─── List URLs ────────────────────────────────────────────
// GET /api/urls
export const listUrls = async (req: Request, res: Response): Promise<void> => {
  const urls = await prisma.url.findMany({
    where: {
      isActive: true,
      // userId: req.user.id  ← added in PR-13
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shortcode: true,
      longUrl: true,
      createdAt: true,
    },
  });

  const data = urls.map((url) => ({
    ...url,
    shortUrl: `${env.BASE_URL}/${url.shortcode}`,
  }));

  res.status(200).json({
    status: "success",
    count: data.length,
    data,
  });
};

// ─── Delete URL ───────────────────────────────────────────
// DELETE /api/urls/:id
//
// Two things happen on delete:
//   1. Soft delete in PostgreSQL (isActive: false)
//   2. Invalidate Redis cache immediately
//
// Why invalidate cache on delete?
//   Without invalidation:
//     User deletes URL → DB updated → cache still has old value
//     Next redirect → cache HIT → serves deleted URL for up to 24h ❌
//
//   With invalidation (this PR):
//     User deletes URL → DB updated → cache key deleted
//     Next redirect → cache MISS → DB lookup → 410 Gone ✅
export const deleteUrl = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const url = await prisma.url.findUnique({
    where: { id },
  });

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  if (!url.isActive) {
    throw new AppError("URL is already deleted", 410);
  }

  // Ownership check added in PR-13:
  // if (url.userId !== req.user.id) throw new AppError("Forbidden", 403)

  // ── Step 1: Soft delete in PostgreSQL ───────────────────
  await prisma.url.update({
    where: { id },
    data: { isActive: false },
  });

  // ── Step 2: Invalidate Redis cache ───────────────────────
  // Must happen AFTER DB update to avoid race condition
  // invalidateCachedUrl never throws — safe to call always
  await invalidateCachedUrl(url.shortcode);

  logger.info("URL deleted", { id, shortcode: url.shortcode });

  res.status(200).json({
    status: "success",
    message: "URL deleted successfully",
  });
};
