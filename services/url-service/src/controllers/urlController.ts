import { Request, Response } from "express";
import { nanoid } from "nanoid";
import prisma from "../config/database";
import { invalidateCachedUrl, warmCache } from "../config/cache";
import env from "../config/env";
import logger from "../config/logger";
import { AppError } from "../middleware/errorHandler";
import { AccessTokenPayload } from "../config/jwt";
import { CreateUrlInput } from "../schemas/urlSchemas";

// ─── Create Short URL ─────────────────────────────────────
// POST /api/urls
// Body: { longUrl: string, customCode?: string }
export const createUrl = async (req: Request, res: Response): Promise<void> => {
  const { longUrl, customCode } = req.body as CreateUrlInput;

  // PR-13: get userId from JWT payload attached by authenticate middleware
  const { userId } = req.user as AccessTokenPayload;

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
    shortcode = nanoid(7);
  }

  // ── Save to database ─────────────────────────────────────
  const url = await prisma.url.create({
    data: {
      shortcode,
      longUrl,
      userId, // ← PR-13: associate URL with authenticated user
    },
  });

  // ── Pre-warm cache ───────────────────────────────────────
  await warmCache(shortcode, longUrl);

  logger.info("URL created", { shortcode, longUrl, userId });

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
// Returns only the authenticated user's URLs
export const listUrls = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.user as AccessTokenPayload;

  const urls = await prisma.url.findMany({
    where: {
      isActive: true,
      userId, // ← PR-13: only return this user's URLs
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
export const deleteUrl = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { userId } = req.user as AccessTokenPayload;

  const url = await prisma.url.findUnique({
    where: { id },
  });

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  if (!url.isActive) {
    throw new AppError("URL is already deleted", 410);
  }

  // ── PR-13: Ownership check ───────────────────────────────
  // Users can only delete their own URLs
  if (url.userId !== userId) {
    throw new AppError("Forbidden", 403);
  }

  // ── Soft delete in PostgreSQL ────────────────────────────
  await prisma.url.update({
    where: { id },
    data: { isActive: false },
  });

  // ── Invalidate Redis cache ───────────────────────────────
  await invalidateCachedUrl(url.shortcode);

  logger.info("URL deleted", { id, shortcode: url.shortcode, userId });

  res.status(200).json({
    status: "success",
    message: "URL deleted successfully",
  });
};
